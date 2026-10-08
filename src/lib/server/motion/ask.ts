import { json } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { findNode, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { findProjectById } from '$lib/server/repos/projects';
import { createRun, failRun, runsByIds, settleRun, type NodeRun } from '$lib/server/repos/node-runs';
import { agentActor } from '$lib/server/repos/actor';
import { motionAsk, offeredChatModels, resolveChoice } from '$lib/server/chat-model/catalogue';
import { runInBackground } from '$lib/server/background-work';
import { motionEditorPath, motionOf, type MotionNode } from '$lib/canvas/motion-node';
import { headOrNew } from '$lib/server/motion/editor';
import { docSummary } from '$lib/server/motion/motion-tools';
import { Browser, startMotionTurn, type MotionTurn, type TurnOutcome } from '$lib/server/motion/turn';

export const MCP_AGENT_KEY = 'mcp';
const ASK_KIND = 'motion-ask';
const HTTP_NOT_FOUND = 404;
const HTTP_UNAVAILABLE = 503;

type Motion = { record: CanvasNodeRecord; node: MotionNode };

async function findMotion(db: Db, scope: { orgId: string; nodeId: string }): Promise<Motion | null> {
  const record = await findNode(db, scope);
  const node = record ? motionOf(record) : null;
  return record && node ? { record, node } : null;
}

const editorUrl = (record: CanvasNodeRecord) => motionEditorPath({ projectId: record.projectId, canvasId: record.canvasId, nodeId: record.id });

const notFound = () => json({ error: 'motion_node_not_found' }, { status: HTTP_NOT_FOUND });

export type AskStarted = { runId: string; model: string; refusedModel: string | null };

export async function askMotion(db: Db, input: { orgId: string; userId: string; nodeId: string; prompt: string; agentKey?: string; choice?: { model?: unknown; reasoning?: unknown } }): Promise<AskStarted | Response> {
  const { orgId, userId, nodeId, prompt, agentKey = MCP_AGENT_KEY, choice: asked = {} } = input;
  const motion = await findMotion(db, { orgId, nodeId });
  const project = motion ? await findProjectById(db, { orgId, projectId: motion.record.projectId }) : null;
  if (!motion || !project) {
    return notFound();
  }

  const guarded = motionAsk(asked);
  const choice = resolveChoice(await offeredChatModels(), guarded.asked);
  if (!choice.ok) {
    return json({ error: choice.error }, { status: HTTP_UNAVAILABLE });
  }

  const turn = await startMotionTurn({
    db,
    userId,
    orgId,
    project,
    motion,
    message: prompt,
    selection: [],
    model: choice.choice.model,
    reasoning: choice.choice.reasoning,
    requester: agentActor(userId, agentKey),
    browser: Browser.Absent
  });
  if (turn instanceof Response) {
    return turn;
  }

  const run = await createRun(db, { orgId, nodeId, prompt, model: choice.choice.model, params: { kind: ASK_KIND }, actorKind: 'agent', actorId: userId });
  runInBackground(() => settleAsk(db, run, turn), ASK_KIND);
  return { runId: run.id, model: choice.choice.model, refusedModel: guarded.refused };
}

async function settleAsk(db: Db, run: NodeRun, turn: MotionTurn): Promise<void> {
  try {
    await turn.stream.pipeTo(new WritableStream());
    const outcome: TurnOutcome = await turn.done;
    await settleRun(db, { orgId: run.orgId, runId: run.id, params: { kind: ASK_KIND, ...outcome }, costUsd: outcome.costUsd });
  } catch (e) {
    await failRun(db, { orgId: run.orgId, runId: run.id, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function askStatus(db: Db, input: { orgId: string; runId: string }): Promise<Record<string, unknown> | Response> {
  const [run] = await runsByIds(db, { ids: [input.runId] });
  const motion = run?.orgId === input.orgId && run.params.kind === ASK_KIND ? await findMotion(db, { orgId: input.orgId, nodeId: run.nodeId }) : null;
  if (!run || !motion) {
    return json({ error: 'run_not_found' }, { status: HTTP_NOT_FOUND });
  }

  const outcome = run.params as Partial<TurnOutcome>;
  return {
    run_id: run.id,
    node_id: run.nodeId,
    status: run.status,
    prompt: run.prompt,
    reply: outcome.reply ?? null,
    summary: outcome.summary ?? null,
    version: outcome.version ?? null,
    revision: outcome.revision ?? null,
    cost_usd: run.costUsd,
    error: run.error,
    editor_url: editorUrl(motion.record),
    started_at: run.startedAt,
    finished_at: run.finishedAt
  };
}

export async function motionSummary(db: Db, input: { orgId: string; nodeId: string }): Promise<Record<string, unknown> | Response> {
  const motion = await findMotion(db, input);
  if (!motion) {
    return notFound();
  }

  const head = await headOrNew(db, input, motion.node);
  return { node_id: motion.record.id, name: motion.record.displayName, version: head.version, last_change: head.summary, last_actor: head.actorKind, editor_url: editorUrl(motion.record), doc: docSummary(head.doc, []) };
}
