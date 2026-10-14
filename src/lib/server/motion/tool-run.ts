import { asSchema, type Tool } from 'ai';
import type { Db } from '$lib/server/db/client';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { agentActor } from '$lib/server/repos/actor';
import { RevisionOutcome, listRevisions, readRevision } from '$lib/server/repos/motion-revisions';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { savedMotion } from './agent-embed';
import { motionAssets, motionTokens, saveMotionDoc } from './editor';
import { templateLibrary } from './templates';
import { exportStill } from './still-export';
import { createMotionTools, type MotionSession, type MotionToolDeps } from './motion-tools';
import { frameMover } from './move-element';

export enum ToolRun {
  Done = 'done',
  NotFound = 'motion_node_not_found',
  Unknown = 'unknown_tool',
  Invalid = 'invalid_input',
  Blocked = 'blocked',
  Conflict = 'conflict'
}

export type ToolRunAsk = { tool: string; input: unknown; version?: number };

export type ToolRunResult = { outcome: ToolRun.Done; output: unknown; version: number; saved: boolean } | { outcome: Exclude<ToolRun, ToolRun.Done>; detail?: string };

export const TOOL_RUN_AGENT_KEY = 'mcp';
const ID_LENGTH = 8;
const HEADLESS = 'needs a chat turn in the editor: ask the motion agent instead';

const newId = () => crypto.randomUUID().slice(0, ID_LENGTH);

const offTurn = async () => ({ ok: false as const, error: HEADLESS });

const freshSession = (doc: MotionSession['doc'], version: number): MotionSession => ({ doc, baseVersion: version, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 });

function toolsFor(deps: Omit<MotionToolDeps, 'voiceover' | 'frames' | 'check' | 'newId'>): Record<string, Tool> {
  return createMotionTools({ ...deps, newId, voiceover: offTurn, frames: async () => null, check: async () => null });
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

export async function runMotionTool(db: Db, scope: { orgId: string; userId: string; nodeId: string }, ask: ToolRunAsk): Promise<ToolRunResult> {
  const saved = await savedMotion(db, scope);
  if (!saved) {
    return { outcome: ToolRun.NotFound };
  }
  if (ask.version !== undefined && ask.version !== saved.version) {
    return { outcome: ToolRun.Conflict, detail: `the video is at revision ${saved.version}, not ${ask.version}` };
  }

  const actor = agentActor(scope.userId, TOOL_RUN_AGENT_KEY);
  const nodeScope = { orgId: scope.orgId, nodeId: scope.nodeId };
  const place = { db, orgId: scope.orgId, projectId: saved.project.id, canvasId: saved.record.canvasId };
  const [assets, tokens] = await Promise.all([motionAssets(place), motionTokens(db, { orgId: scope.orgId, brandId: saved.project.brandId })]);
  const session = freshSession(saved.doc, saved.version);
  const tools = toolsFor({
    session,
    assets,
    templates: templateLibrary(db, { orgId: scope.orgId, actor }),
    revisions: { list: () => listRevisions(db, nodeScope), read: async (version) => (await readRevision(db, { ...nodeScope, version }))?.doc ?? null },
    exportStill: (doc, spec) => exportStill(db, { orgId: scope.orgId, projectId: saved.project.id, nodeId: scope.nodeId }, doc, spec, { tokens, assets }),
    moveOut: frameMover(db, { orgId: scope.orgId, actor, projectId: saved.project.id }, scope.nodeId)
  });

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

  const output = await found.execute(input.value, { toolCallId: `${TOOL_RUN_AGENT_KEY}-${newId()}`, messages: [], context: {} });
  if (session.doc === saved.doc) {
    return { outcome: ToolRun.Done, output, version: saved.version, saved: false };
  }

  const write = await saveMotionDoc(db, { ...nodeScope, expectedVersion: saved.version, doc: session.doc, actor, summary: session.edits.join('; ') || ask.tool });
  if (write.outcome === RevisionOutcome.Invalid) {
    return { outcome: ToolRun.Invalid, detail: write.error };
  }
  if (write.outcome !== RevisionOutcome.Written) {
    return { outcome: ToolRun.Conflict };
  }
  return { outcome: ToolRun.Done, output, version: write.head.version, saved: true };
}
