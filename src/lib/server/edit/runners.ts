import { z } from 'zod';
import type { OrgCaller } from '$lib/server/org-data/auth';
import { gateOrgAiAction } from '$lib/server/cli-auth';
import { findProjectById } from '$lib/server/repos/projects';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { Access, CANVAS_OPS, canvasCtx, type CanvasOpName } from '$lib/server/canvas/canvas-ops';
import { agentActor } from '$lib/server/repos/actor';
import { MCP_AGENT_KEY } from '$lib/server/motion/ask';
import { callerMotionScope } from '$lib/server/motion/editor-scope';
import { EDITOR_OPS, EditorAccess, runEditorOp, type EditorAnswer, type EditorOpName } from '$lib/server/frame-editor/editor-ops';
import { MAX_BATCH_OPS, SPENDING_TOOLS, ToolRun, refusalOf, runMotionBatch, runMotionTool } from '$lib/server/motion/tool-run';

export type Answer = { status: number; body: unknown };

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE = 422;

export const BATCH = 'batch';

const READ_ONLY_KEY: Answer = { status: HTTP_FORBIDDEN, body: { error: 'api_key_read_only' } };

const keyOf = (caller: OrgCaller) => (caller.apiKeyId ? { id: caller.apiKeyId, name: '', user_id: caller.userId, org_id: caller.orgId, scopes: ['write'] } : undefined);

async function denial(caller: OrgCaller): Promise<Answer | undefined> {
  const denied = await gateOrgAiAction(caller.orgId, keyOf(caller));
  return denied ? { status: denied.status, body: await denied.json() } : undefined;
}

const GATE_OF: Record<Access, (caller: OrgCaller) => Promise<Answer | undefined>> = {
  [Access.Read]: async () => undefined,
  [Access.Write]: async (caller) => (caller.writeAllowed ? undefined : READ_ONLY_KEY),
  [Access.Spend]: async (caller) => (caller.writeAllowed ? denial(caller) : READ_ONLY_KEY)
};

export type CanvasAsk = { projectId: string; op: CanvasOpName; input: unknown };

export async function runCanvasOp(caller: OrgCaller, ask: CanvasAsk): Promise<Answer> {
  const op = CANVAS_OPS[ask.op];

  const input = op.input.safeParse(ask.input ?? {});
  if (!input.success) {
    return { status: HTTP_BAD_REQUEST, body: { error: 'invalid_input', issues: input.error.issues } };
  }

  const project = await findProjectById(caller.db, { orgId: caller.orgId, projectId: ask.projectId });
  if (!project || !(await canvasReachable(caller.db, { orgId: caller.orgId, mode: project.mode }, caller.userId))) {
    return { status: HTTP_NOT_FOUND, body: { error: 'project_not_found' } };
  }

  const denied = await GATE_OF[op.access](caller);
  if (denied) {
    return denied;
  }

  const ctx = canvasCtx({ db: caller.db, orgId: caller.orgId, projectId: project.id, userId: caller.userId, brandId: project.brandId });
  return { status: HTTP_OK, body: await op.run(ctx, input.data as never) };
}

const STATUS_OF: Record<Exclude<ToolRun, ToolRun.Done>, number> = {
  [ToolRun.NotFound]: HTTP_NOT_FOUND,
  [ToolRun.Unknown]: HTTP_NOT_FOUND,
  [ToolRun.Invalid]: HTTP_BAD_REQUEST,
  [ToolRun.Blocked]: HTTP_UNPROCESSABLE,
  [ToolRun.Conflict]: HTTP_CONFLICT,
  [ToolRun.Refused]: HTTP_UNPROCESSABLE
};

const batchSchema = z.object({ ops: z.array(z.object({ tool: z.string().min(1).refine((t) => t !== BATCH, 'a batch does not nest'), input: z.unknown().optional() })).min(1).max(MAX_BATCH_OPS) });

export const frameToolBody = z.object({ tool: z.string().min(1), input: z.unknown().optional(), version: z.number().int().min(0).optional() });

export type FrameToolAsk = z.infer<typeof frameToolBody> & { nodeId: string };

export async function runFrameTool(caller: OrgCaller, ask: FrameToolAsk): Promise<Answer> {
  if (!caller.writeAllowed) {
    return READ_ONLY_KEY;
  }

  const scope = { orgId: caller.orgId, userId: caller.userId, nodeId: ask.nodeId };
  const gated = async (tools: string[]) => (tools.some((t) => SPENDING_TOOLS.has(t)) ? denial(caller) : undefined);

  if (ask.tool === BATCH) {
    const ops = batchSchema.safeParse(ask.input);
    if (!ops.success) {
      return { status: HTTP_BAD_REQUEST, body: { error: ToolRun.Invalid, detail: ops.error.issues[0]?.message } };
    }
    const denied = await gated(ops.data.ops.map((o) => o.tool));
    if (denied) {
      return denied;
    }
    const ran = await runMotionBatch(caller.db, scope, ops.data.ops, ask.version);
    if (ran.outcome !== ToolRun.Done) {
      return { status: STATUS_OF[ran.outcome], body: { error: ran.outcome, ...ran, outcome: undefined } };
    }
    return { status: HTTP_OK, body: { tool: BATCH, version: ran.version, saved: ran.saved, output: ran.output } };
  }

  const denied = await gated([ask.tool]);
  if (denied) {
    return denied;
  }

  const run = await runMotionTool(caller.db, scope, { tool: ask.tool, input: ask.input, version: ask.version });
  if (run.outcome !== ToolRun.Done) {
    return { status: STATUS_OF[run.outcome], body: { error: run.outcome, detail: run.detail } };
  }
  const refused = refusalOf(run.output);
  if (refused) {
    return { status: STATUS_OF[ToolRun.Refused], body: { error: ToolRun.Refused, detail: refused, output: run.output } };
  }
  return { status: HTTP_OK, body: { tool: ask.tool, version: run.version, saved: run.saved, output: run.output } };
}

export type EditorAsk = { nodeId: string; op: EditorOpName; input: unknown };

export async function runEditorAction(caller: OrgCaller, ask: EditorAsk): Promise<EditorAnswer> {
  const input = EDITOR_OPS[ask.op].input.safeParse(ask.input ?? {});
  if (!input.success) {
    return { status: HTTP_BAD_REQUEST, body: { error: 'invalid_input', issues: input.error.issues } };
  }
  if (EDITOR_OPS[ask.op].access === EditorAccess.Write && !caller.writeAllowed) {
    return { status: HTTP_FORBIDDEN, body: { error: 'api_key_read_only' } };
  }

  const scope = await callerMotionScope(caller.db, { orgId: caller.orgId, userId: caller.userId, nodeId: ask.nodeId });
  if (!scope) {
    return { status: HTTP_NOT_FOUND, body: { error: 'motion_node_not_found' } };
  }

  const gate = async (): Promise<EditorAnswer | null> => (await denial(caller)) as EditorAnswer | null;
  return runEditorOp(ask.op, { ...scope, actor: agentActor(caller.userId, MCP_AGENT_KEY), gate }, input.data as never);
}
