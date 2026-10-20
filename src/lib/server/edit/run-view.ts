import { z } from 'zod';
import type { OrgCaller } from '$lib/server/org-data/auth';
import { callerReach } from '$lib/server/org-data/reach';
import { openCanvasForUser } from '$lib/server/canvas/lookup';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { loadGenRuns } from '$lib/server/canvas/snapshot';
import { findNode, listConnections, listNodes } from '$lib/server/repos/canvas';
import { listCanvasEvents } from '$lib/server/repos/canvas-events';
import { runningRuns } from '$lib/server/repos/node-runs';
import { readHead } from '$lib/server/repos/motion-revisions';
import { FramesFailure, motionFrames } from '$lib/server/motion/agent-frames';
import { serverFramesOpen } from '$lib/server/motion/chromium-frames';
import { FramesSource, fetchRemoteFrames, framesSource, remoteRenderUrl } from './frames-source';
import type { MotionDoc } from '$lib/motion/doc';
import { detailOf, elementsOf, summarizeCanvas } from './canvas-summary';
import type { Answer } from './runners';

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_TOO_MANY = 429;
const HTTP_UNAVAILABLE = 503;
const MOTION_NODE = 'motion';
const ACTIVITY_EVENTS = 50;
const ACTIVE_RUNS_SCAN = 500;

export enum ViewOp {
  CanvasSummary = 'canvas_summary',
  Get = 'get',
  Activity = 'activity',
  Snapshot = 'snapshot'
}

const canvasId = z.string().min(1);

export const VIEW_OPS = {
  [ViewOp.CanvasSummary]: { summary: 'Compact outline of a canvas: every node (id, type, title, place, size, wiring, last run status) and, for each frame, the tree of its elements (id, kind, name, bounds, text).', input: z.object({ canvas_id: canvasId }).strict() },
  [ViewOp.Get]: { summary: 'Full detail of one node (`id`), or of one element of a frame (`id` = element, `frame_id` = its frame): data, props, transform, keyframes.', input: z.object({ id: z.string().min(1), frame_id: z.string().optional() }).strict() },
  [ViewOp.Activity]: { summary: 'What is happening on a canvas now: recent structural events (who, what, when), runs still working, and presence.', input: z.object({ canvas_id: canvasId, since: z.string().optional().describe('ISO time; only newer events') }).strict() },
  [ViewOp.Snapshot]: { summary: 'An image of one frame at a time (seconds, default 0), returned as an image. Drawn by the server renderer, or by the remote one when this server has none; a whole canvas, a region or a single element cannot be drawn alone: snapshot their frame.', input: z.object({ node_id: z.string().min(1), element_id: z.string().optional(), canvas_id: z.string().optional(), region: z.unknown().optional(), time: z.number().min(0).optional(), width: z.number().int().min(64).optional() }).strict() }
} as const;

export const isViewOp = (name: string): name is ViewOp => Object.hasOwn(VIEW_OPS, name);

const refusal = (status: number, error: string, extra: Record<string, unknown> = {}): Answer => ({ status, body: { error, ...extra } });

const FRAMES_STATUS: Record<FramesFailure, number> = {
  [FramesFailure.NotFound]: HTTP_NOT_FOUND,
  [FramesFailure.Empty]: HTTP_CONFLICT,
  [FramesFailure.BadTimes]: HTTP_BAD_REQUEST,
  [FramesFailure.Limited]: HTTP_TOO_MANY,
  [FramesFailure.Closed]: HTTP_UNAVAILABLE
};

async function openCanvas(caller: OrgCaller, id: string) {
  const { found } = await openCanvasForUser(caller.db, { userId: caller.userId, canvasId: id });
  if (!found || found.orgId !== caller.orgId || !(await canvasReachable(caller.db, found, caller.userId))) {
    return null;
  }
  return found;
}

async function docsOf(caller: OrgCaller, nodes: { id: string; type: string }[]): Promise<Map<string, MotionDoc>> {
  const frames = nodes.filter((n) => n.type === MOTION_NODE);
  const heads = await Promise.all(frames.map((n) => readHead(caller.db, { orgId: caller.orgId, nodeId: n.id })));
  return new Map(frames.flatMap((n, i) => (heads[i] ? [[n.id, heads[i].doc as MotionDoc] as const] : [])));
}

async function canvasSummary(caller: OrgCaller, input: { canvas_id: string }): Promise<Answer> {
  if (!(await openCanvas(caller, input.canvas_id))) {
    return refusal(HTTP_NOT_FOUND, 'canvas_not_found');
  }
  const scope = { orgId: caller.orgId, canvasId: input.canvas_id };
  const [nodes, connections] = await Promise.all([listNodes(caller.db, scope), listConnections(caller.db, scope)]);
  const [runs, docs] = await Promise.all([loadGenRuns(caller.db, { orgId: caller.orgId, nodes }), docsOf(caller, nodes)]);
  return { status: HTTP_OK, body: summarizeCanvas({ canvasId: input.canvas_id, nodes, connections, runs: runs as never, docs }) };
}

async function getOne(caller: OrgCaller, input: { id: string; frame_id?: string }): Promise<Answer> {
  const nodeId = input.frame_id ?? input.id;
  const node = await findNode(caller.db, { orgId: caller.orgId, nodeId });
  if (!node) {
    return refusal(HTTP_NOT_FOUND, 'not_found', { id: nodeId });
  }
  if (!input.frame_id) {
    const doc = node.type === MOTION_NODE ? (await docsOf(caller, [node])).get(node.id) : undefined;
    return { status: HTTP_OK, body: { node, ...(doc ? { frame: { width: doc.width, height: doc.height }, elements: elementsOf(doc) } : {}) } };
  }
  const doc = (await docsOf(caller, [node])).get(node.id);
  const element = doc ? detailOf(doc, input.id) : null;
  return element ? { status: HTTP_OK, body: { frame_id: node.id, element } } : refusal(HTTP_NOT_FOUND, 'element_not_found', { frame_id: node.id, id: input.id });
}

async function activity(caller: OrgCaller, input: { canvas_id: string; since?: string }): Promise<Answer> {
  if (!(await openCanvas(caller, input.canvas_id))) {
    return refusal(HTTP_NOT_FOUND, 'canvas_not_found');
  }
  const scope = { orgId: caller.orgId, canvasId: input.canvas_id };
  const [events, running, nodes] = await Promise.all([listCanvasEvents(caller.db, { ...scope, limit: ACTIVITY_EVENTS }), runningRuns(caller.db, { limit: ACTIVE_RUNS_SCAN }), listNodes(caller.db, scope)]);
  const here = new Set(nodes.map((n) => n.id));
  const since = input.since ? Date.parse(input.since) : Number.NEGATIVE_INFINITY;
  return {
    status: HTTP_OK,
    body: {
      canvas_id: input.canvas_id,
      events: events.filter((e) => Date.parse(e.createdAt) > since).map((e) => ({ kind: e.kind, node_id: e.nodeId, edge_id: e.edgeId, actor: e.actorKind, agent: e.agentKey, at: e.createdAt })),
      running: running.filter((r) => here.has(r.nodeId)).map((r) => ({ run_id: r.id, node_id: r.nodeId, model: r.model, since: r.startedAt })),
      presence: { available: false, reason: 'Presence lives in the live canvas channel; the server cannot read who is on the canvas or what they select.' }
    }
  };
}

export type ViewContext = { bearer: string; ownOrigin: string; org?: string };

async function snapshot(caller: OrgCaller, input: z.infer<(typeof VIEW_OPS)[ViewOp.Snapshot]['input']>, via: ViewContext): Promise<Answer> {
  if (input.element_id || input.region !== undefined || !input.node_id) {
    return refusal(HTTP_BAD_REQUEST, 'snapshot_unsupported', { fix: 'Snapshot a frame by `node_id`; an element or a region is seen inside its frame. canvas_summary gives the outline in words.' });
  }
  const remoteUrl = remoteRenderUrl(process.env);
  if (framesSource({ open: serverFramesOpen(), remoteUrl, ownOrigin: via.ownOrigin }) === FramesSource.Remote) {
    return fetchRemoteFrames(remoteUrl!, { nodeId: input.node_id, times: [input.time ?? 0], width: input.width, bearer: via.bearer, org: via.org });
  }
  const answer = await motionFrames(caller.db, { orgId: caller.orgId, nodeId: input.node_id }, { times: [input.time ?? 0], size: input.width });
  return answer.ok ? { status: HTTP_OK, body: answer.body } : refusal(FRAMES_STATUS[answer.failure], answer.failure, { detail: answer.detail, fix: answer.failure === FramesFailure.Closed ? 'Use canvas_summary for the structure, or open the frame editor.' : undefined });
}

const RUN = { [ViewOp.CanvasSummary]: canvasSummary, [ViewOp.Get]: getOne, [ViewOp.Activity]: activity, [ViewOp.Snapshot]: snapshot } as Record<ViewOp, (c: OrgCaller, i: never, via: ViewContext) => Promise<Answer>>;

export async function runView(caller: OrgCaller, op: ViewOp, input: Record<string, unknown>, via: ViewContext): Promise<Answer> {
  const parsed = VIEW_OPS[op].input.safeParse(input);
  if (!parsed.success) {
    return refusal(HTTP_BAD_REQUEST, 'invalid_input', { issues: parsed.error.issues });
  }
  const data = parsed.data as never as Record<string, string>;
  const nodeId = data.node_id ?? data.frame_id ?? data.id;
  const hidden = nodeId ? await callerReach(caller, { nodes: [nodeId] }) : null;
  if (hidden) {
    return { status: hidden.status, body: await hidden.json() };
  }
  return RUN[op](caller, parsed.data as never, via);
}
