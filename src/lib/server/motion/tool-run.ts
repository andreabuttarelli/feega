import { orgFontFamilies } from './font-upload';
import { asSchema, type Tool } from 'ai';
import { nameVersion, namedRevisions } from './version-names';
import type { Db } from '$lib/server/db/client';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { agentActor } from '$lib/server/repos/actor';
import { Checkpoint, readRevision } from '$lib/server/repos/motion-revisions';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { savedMotionWith } from './agent-embed';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { assetUrls, motionAssets, motionTokens, type MotionAsset } from './editor';
import { OpsOutcome, commitDoc } from './frame-ops';
import { templateLibrary } from './templates';
import { exportStill } from './still-export';
import { createMotionTools, type MotionSession, type MotionToolDeps } from './motion-tools';
import { frameMover } from './move-element';
import { drawFrames, firstFrames } from './server-frames';
import { fontAdvance } from './font-advance';
import { chromiumFrames, serverFramesOpen } from './chromium-frames';
import type { Frame } from './frames';
import type { MotionDoc } from '$lib/motion/doc';

export enum ToolRun {
  Done = 'done',
  NotFound = 'motion_node_not_found',
  Unknown = 'unknown_tool',
  Invalid = 'invalid_input',
  Blocked = 'blocked',
  Conflict = 'conflict',
  Refused = 'tool_refused'
}

export type ToolRunAsk = { tool: string; input: unknown; version?: number; callId?: string };

export type ToolRunScope = { orgId: string; userId: string; nodeId: string; projectId?: string; agentKey?: string };

export type EditorFrames = (callId: string, times: number[], doc: MotionDoc) => Promise<Frame[] | null>;

export type ToolRunTurn = { sessions: Map<string, MotionSession>; selection: string[]; editor: EditorFrames | null };

export type ToolRunResult = { outcome: ToolRun.Done; output: unknown; version: number; saved: boolean; frames: Frame[] } | { outcome: Exclude<ToolRun, ToolRun.Done | ToolRun.Refused>; detail?: string };

export const TOOL_RUN_AGENT_KEY = 'mcp';
const ID_LENGTH = 8;
const HEADLESS = 'needs a chat turn in the editor: ask the motion agent instead';

const readFontAdvance = fontAdvance();

function once<T>(make: () => Promise<T>): () => Promise<T> {
  let made: Promise<T> | null = null;
  return () => (made ??= make());
}

const newId = () => crypto.randomUUID().slice(0, ID_LENGTH);

const offTurn = async () => ({ ok: false as const, error: HEADLESS });

const freshSession = (doc: MotionSession['doc'], version: number): MotionSession => ({ doc, baseVersion: version, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 });

const noFrames: MotionToolDeps['frames'] = async () => null;

function toolsFor(deps: Omit<MotionToolDeps, 'voiceover' | 'frames' | 'check' | 'newId'>, frames = noFrames): Record<string, Tool> {
  return createMotionTools({ ...deps, newId, voiceover: offTurn, frames, check: async () => null, fontAdvance: readFontAdvance });
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

export type BatchOp = { tool: string; input?: unknown };

export type BatchResult = { outcome: ToolRun.Done; output: { results: unknown[] }; version: number; saved: boolean } | { outcome: Exclude<ToolRun, ToolRun.Done>; detail?: string; index?: number } | { outcome: ToolRun.Refused; detail: string; index: number; output: unknown };

type Prepared = { saved: NonNullable<Awaited<ReturnType<typeof savedMotionWith<MotionAsset[]>>>>; session: MotionSession; tools: Record<string, Tool>; actor: ReturnType<typeof agentActor>; nodeScope: { orgId: string; nodeId: string } };

type Failure = { outcome: Exclude<ToolRun, ToolRun.Done | ToolRun.Refused>; detail?: string };

async function prepare(db: Db, scope: ToolRunScope, version: number | undefined, turn?: ToolRunTurn): Promise<Prepared | Failure> {
  const place = (record: CanvasNodeRecord) => ({ db, orgId: scope.orgId, projectId: record.projectId, canvasId: record.canvasId });
  const saved = await savedMotionWith(db, scope, (record) => motionAssets(place(record)));
  if (!saved || (scope.projectId && saved.project.id !== scope.projectId)) {
    return { outcome: ToolRun.NotFound };
  }
  if (version !== undefined && version !== saved.version) {
    return { outcome: ToolRun.Conflict, detail: `the video is at revision ${saved.version}, not ${version}` };
  }

  const actor = agentActor(scope.userId, scope.agentKey ?? TOOL_RUN_AGENT_KEY);
  const nodeScope = { orgId: scope.orgId, nodeId: scope.nodeId };
  const assets = saved.alongside;
  const tokens = once(() => motionTokens(db, { orgId: scope.orgId, brandId: saved.project.brandId }));
  const session = carried(turn, scope.nodeId, saved.doc, saved.version);
  const editor = turn?.editor;
  const server = async (times: number[]) => (serverFramesOpen() ? drawFrames(chromiumFrames, { compose: { doc: session.doc, tokens: await tokens(), assets: assetUrls(assets) }, times }) : null);
  const frames: MotionToolDeps['frames'] = turn ? (callId, times) => firstFrames([async () => (editor ? editor(callId, times, session.doc) : null), () => server(times)]) : noFrames;
  const tools = toolsFor({
    session,
    assets,
    templates: templateLibrary(db, { orgId: scope.orgId, actor }),
    revisions: { list: () => namedRevisions(db, nodeScope), read: async (v) => (await readRevision(db, { ...nodeScope, version: v }))?.doc ?? null, name: async (v, name) => (await nameVersion(db, { ...nodeScope, version: v, name, actor })).named },
    exportStill: async (doc, spec) => exportStill(db, { orgId: scope.orgId, projectId: saved.project.id, nodeId: scope.nodeId }, doc, spec, { tokens: await tokens(), assets }),
    moveOut: frameMover(db, { orgId: scope.orgId, actor, projectId: saved.project.id }, scope.nodeId),
    fonts: () => orgFontFamilies(db, scope.orgId)
  }, frames);
  return { saved, session, tools, actor, nodeScope };
}

const isFailure = <T extends object>(p: T | Failure): p is Failure => 'outcome' in p;

type Checked = { found: Tool & { execute: NonNullable<Tool['execute']> }; value: unknown };

async function checked(ready: Prepared, ask: BatchOp): Promise<Checked | Failure> {
  const found = ready.tools[ask.tool];
  if (!found?.execute) {
    return { outcome: ToolRun.Unknown, detail: `no motion tool ${ask.tool}: GET /api/v1/motion/tools lists them` };
  }
  const input = await validInput(found, ask.input ?? {});
  if (!input.ok) {
    return { outcome: ToolRun.Invalid, detail: input.error };
  }
  return { found: found as Checked['found'], value: input.value };
}

const IDENTIFIER_KEY = /(^|_)ids?$/;

function textsOf(value: unknown, key = ''): string[] {
  if (typeof value === 'string') {
    return IDENTIFIER_KEY.test(key) ? [] : [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => textsOf(item, key));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => textsOf(v, k));
  }
  return [];
}

async function screened(db: Db, scope: ToolRunScope, ready: Prepared, values: unknown[]): Promise<Failure | null> {
  const outcome = await screenModelInput(db, { profile: ModerationProfile.Standard, texts: values.flatMap((v) => textsOf(v)), scope: { ...scope, projectId: ready.saved.project.id, actor: ready.actor } });
  return outcome.ok ? null : { outcome: ToolRun.Blocked, detail: outcome.error };
}

const execute = async (ran: Checked, callId: string) => ran.found.execute(ran.value, { toolCallId: callId, messages: [], context: {} });

async function commit(db: Db, ready: Prepared, summary: string): Promise<{ version: number; saved: boolean } | Failure> {
  const { saved, session } = ready;
  if (session.doc === saved.doc) {
    return { version: saved.version, saved: false };
  }
  const written = await commitDoc(db, { ...ready.nodeScope, node: saved.node, record: saved.record, checkpoint: Checkpoint.Coalesce, base: saved, doc: session.doc, actor: ready.actor, summary: session.edits.join('; ') || summary });
  if (written.outcome === OpsOutcome.Invalid) {
    return { outcome: ToolRun.Invalid, detail: written.error };
  }
  if (written.outcome !== OpsOutcome.Written) {
    return { outcome: ToolRun.Conflict };
  }
  return { version: written.head.version, saved: true };
}

export function refusalOf(output: unknown): string | null {
  if (!output || typeof output !== 'object' || (output as { ok?: unknown }).ok !== false) {
    return null;
  }
  const error = (output as { error?: unknown }).error;
  return typeof error === 'string' ? error : 'the tool refused';
}

export const MAX_BATCH_OPS = 500;

export async function runMotionBatch(db: Db, scope: ToolRunScope, ops: BatchOp[], version?: number): Promise<BatchResult> {
  const ready = await prepare(db, scope, version);
  if (isFailure(ready)) {
    return ready;
  }

  const asks: Checked[] = [];
  for (const [index, op] of ops.entries()) {
    const ask = await checked(ready, op);
    if (isFailure(ask)) {
      return { ...ask, index };
    }
    asks.push(ask);
  }
  const blocked = await screened(db, scope, ready, asks.map((a) => a.value));
  if (blocked) {
    return blocked;
  }

  const results: unknown[] = [];
  for (const [index, ask] of asks.entries()) {
    const output = await execute(ask, `${TOOL_RUN_AGENT_KEY}-${newId()}`);
    const refused = refusalOf(output);
    if (refused) {
      return { outcome: ToolRun.Refused, detail: refused, index, output };
    }
    results.push(output);
  }
  const written = await commit(db, ready, `batch of ${ops.length}`);
  return 'outcome' in written ? written : { outcome: ToolRun.Done, output: { results }, ...written };
}

export async function runMotionTool(db: Db, scope: ToolRunScope, ask: ToolRunAsk, turn?: ToolRunTurn): Promise<ToolRunResult> {
  const ready = await prepare(db, scope, ask.version, turn);
  if (isFailure(ready)) {
    return ready;
  }
  const ran = await checked(ready, ask);
  if (isFailure(ran)) {
    return ran;
  }
  const blocked = await screened(db, scope, ready, [ran.value]);
  if (blocked) {
    return blocked;
  }

  const callId = ask.callId ?? `${TOOL_RUN_AGENT_KEY}-${newId()}`;
  const output = await execute(ran, callId);
  const seen = ready.session.frames.get(callId) ?? [];
  const written = await commit(db, ready, ask.tool);
  return 'outcome' in written ? written : { outcome: ToolRun.Done, output, frames: seen, ...written };
}
