import { asSchema, type Tool } from 'ai';
import type { Db } from '$lib/server/db/client';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { agentActor } from '$lib/server/repos/actor';
import { RevisionOutcome, listRevisions, readRevision } from '$lib/server/repos/motion-revisions';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { savedMotion } from './agent-embed';
import { assetUrls, motionAssets, motionTokens, saveMotionDoc } from './editor';
import { templateLibrary } from './templates';
import { exportStill } from './still-export';
import { createMotionTools, type MotionSession, type MotionToolDeps } from './motion-tools';
import { drawFrames, firstFrames } from './server-frames';
import { chromiumFrames, serverFramesOpen } from './chromium-frames';
import type { Frame } from './frames';
import type { MotionDoc } from '$lib/motion/doc';

export enum ToolRun {
  Done = 'done',
  NotFound = 'motion_node_not_found',
  Unknown = 'unknown_tool',
  Invalid = 'invalid_input',
  Blocked = 'blocked',
  Conflict = 'conflict'
}

export type ToolRunAsk = { tool: string; input: unknown; version?: number; callId?: string };

export type ToolRunScope = { orgId: string; userId: string; nodeId: string; projectId?: string; agentKey?: string };

export type EditorFrames = (callId: string, times: number[], doc: MotionDoc) => Promise<Frame[] | null>;

export type ToolRunTurn = { sessions: Map<string, MotionSession>; selection: string[]; editor: EditorFrames | null };

export type ToolRunResult = { outcome: ToolRun.Done; output: unknown; version: number; saved: boolean; frames: Frame[] } | { outcome: Exclude<ToolRun, ToolRun.Done>; detail?: string };

export const TOOL_RUN_AGENT_KEY = 'mcp';
const ID_LENGTH = 8;
const HEADLESS = 'needs a chat turn in the editor: ask the motion agent instead';

const newId = () => crypto.randomUUID().slice(0, ID_LENGTH);

const offTurn = async () => ({ ok: false as const, error: HEADLESS });

const freshSession = (doc: MotionSession['doc'], version: number): MotionSession => ({ doc, baseVersion: version, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 });

const noFrames: MotionToolDeps['frames'] = async () => null;

function toolsFor(deps: Omit<MotionToolDeps, 'voiceover' | 'frames' | 'check' | 'newId'>, frames = noFrames): Record<string, Tool> {
  return createMotionTools({ ...deps, newId, voiceover: offTurn, frames, check: async () => null });
}

function carried(turn: ToolRunTurn | undefined, nodeId: string, doc: MotionDoc, version: number): MotionSession {
  const kept = turn?.sessions.get(nodeId);
  const session = kept ? Object.assign(kept, { doc, baseVersion: version, edits: [] }) : { ...freshSession(doc, version), selection: turn?.selection ?? [] };
  turn?.sessions.set(nodeId, session);
  return session;
}

export type ToolEntry = { name: string; summary: string };

export type ToolSpec = { name: string; description: string; input_schema: unknown };

const catalogue = () => toolsFor({ session: freshSession(newMotionDoc(MotionFormat.Landscape), 0), assets: [] });

const describedBy = (found: Tool) => (typeof found.description === 'string' ? found.description : '');

const firstSentence = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text;

export function motionToolList(): ToolEntry[] {
  return Object.entries(catalogue()).map(([name, t]) => ({ name, summary: firstSentence(describedBy(t)) }));
}

export async function motionToolSpec(name: string): Promise<ToolSpec | null> {
  const found = catalogue()[name];
  return found ? { name, description: describedBy(found), input_schema: await asSchema(found.inputSchema).jsonSchema } : null;
}

async function validInput(found: Tool, input: unknown): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const schema = asSchema(found.inputSchema);
  const checked = await schema.validate?.(input);
  if (!checked) {
    return { ok: true, value: input };
  }
  return checked.success ? { ok: true, value: checked.value } : { ok: false, error: checked.error.message };
}

export async function runMotionTool(db: Db, scope: ToolRunScope, ask: ToolRunAsk, turn?: ToolRunTurn): Promise<ToolRunResult> {
  const saved = await savedMotion(db, scope);
  if (!saved || (scope.projectId && saved.project.id !== scope.projectId)) {
    return { outcome: ToolRun.NotFound };
  }
  if (ask.version !== undefined && ask.version !== saved.version) {
    return { outcome: ToolRun.Conflict, detail: `the video is at revision ${saved.version}, not ${ask.version}` };
  }

  const actor = agentActor(scope.userId, scope.agentKey ?? TOOL_RUN_AGENT_KEY);
  const nodeScope = { orgId: scope.orgId, nodeId: scope.nodeId };
  const place = { db, orgId: scope.orgId, projectId: saved.project.id, canvasId: saved.record.canvasId };
  const [assets, tokens] = await Promise.all([motionAssets(place), motionTokens(db, { orgId: scope.orgId, brandId: saved.project.brandId })]);
  const session = carried(turn, scope.nodeId, saved.doc, saved.version);
  const editor = turn?.editor;
  const server = async (times: number[]) => (serverFramesOpen() ? drawFrames(chromiumFrames, { compose: { doc: session.doc, tokens, assets: assetUrls(assets) }, times }) : null);
  const frames: MotionToolDeps['frames'] = turn ? (callId, times) => firstFrames([async () => (editor ? editor(callId, times, session.doc) : null), () => server(times)]) : noFrames;
  const tools = toolsFor({
    session,
    assets,
    templates: templateLibrary(db, { orgId: scope.orgId, actor }),
    revisions: { list: () => listRevisions(db, nodeScope), read: async (version) => (await readRevision(db, { ...nodeScope, version }))?.doc ?? null },
    exportStill: (doc, spec) => exportStill(db, { orgId: scope.orgId, projectId: saved.project.id, nodeId: scope.nodeId }, doc, spec, { tokens, assets })
  }, frames);

  const found = tools[ask.tool];
  if (!found?.execute) {
    return { outcome: ToolRun.Unknown, detail: `no motion tool ${ask.tool}: GET /api/v1/motion/tools lists them` };
  }
  const input = await validInput(found, ask.input ?? {});
  if (!input.ok) {
    return { outcome: ToolRun.Invalid, detail: input.error };
  }
  const screened = await screenModelInput(db, { profile: ModerationProfile.Standard, texts: [JSON.stringify(input.value)], scope: { ...scope, projectId: saved.project.id, actor } });
  if (!screened.ok) {
    return { outcome: ToolRun.Blocked, detail: screened.error };
  }

  const callId = ask.callId ?? `${TOOL_RUN_AGENT_KEY}-${newId()}`;
  const output = await found.execute(input.value, { toolCallId: callId, messages: [], context: {} });
  const seen = session.frames.get(callId) ?? [];
  if (session.doc === saved.doc) {
    return { outcome: ToolRun.Done, output, version: saved.version, saved: false, frames: seen };
  }

  const write = await saveMotionDoc(db, { ...nodeScope, expectedVersion: saved.version, doc: session.doc, actor, summary: session.edits.join('; ') || ask.tool });
  if (write.outcome === RevisionOutcome.Invalid) {
    return { outcome: ToolRun.Invalid, detail: write.error };
  }
  if (write.outcome !== RevisionOutcome.Written) {
    return { outcome: ToolRun.Conflict };
  }
  return { outcome: ToolRun.Done, output, version: write.head.version, saved: true, frames: seen };
}
