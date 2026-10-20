import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { reachableCaller } from '$lib/server/org-data/reach';
import { gateOrgAiAction } from '$lib/server/cli-auth';
import { MAX_BATCH_OPS, SPENDING_TOOLS, ToolRun, refusalOf, runMotionBatch, runMotionTool } from '$lib/server/motion/tool-run';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 60, memory: 2048 };

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE = 422;

const STATUS_OF: Record<Exclude<ToolRun, ToolRun.Done>, number> = {
  [ToolRun.NotFound]: HTTP_NOT_FOUND,
  [ToolRun.Unknown]: HTTP_NOT_FOUND,
  [ToolRun.Invalid]: HTTP_BAD_REQUEST,
  [ToolRun.Blocked]: HTTP_UNPROCESSABLE,
  [ToolRun.Conflict]: HTTP_CONFLICT,
  [ToolRun.Refused]: HTTP_UNPROCESSABLE
};

const BATCH = 'batch';

const batchSchema = z.object({ ops: z.array(z.object({ tool: z.string().min(1).refine((t) => t !== BATCH, 'a batch does not nest'), input: z.unknown().optional() })).min(1).max(MAX_BATCH_OPS) });

const bodySchema = z.object({ tool: z.string().min(1), input: z.unknown().optional(), version: z.number().int().min(0).optional() });

export const POST: RequestHandler = async ({ request, params, url }) => {
  const caller = await reachableCaller(request, url, { nodes: [params.nodeId ?? ''] });
  if (caller instanceof Response) {
    return caller;
  }
  const { db, orgId, userId, writeAllowed, apiKeyId } = caller;
  if (!writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: ToolRun.Invalid, detail: body.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
  }

  const scope = { orgId, userId, nodeId: params.nodeId ?? '' };
  const key = apiKeyId ? { id: apiKeyId, name: '', user_id: userId, org_id: orgId, scopes: ['write'] } : undefined;
  const gated = async (tools: string[]) => (tools.some((t) => SPENDING_TOOLS.has(t)) ? gateOrgAiAction(orgId, key) : undefined);

  if (body.data.tool === BATCH) {
    const ops = batchSchema.safeParse(body.data.input);
    if (!ops.success) {
      return json({ error: ToolRun.Invalid, detail: ops.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
    }
    const denied = await gated(ops.data.ops.map((o) => o.tool));
    if (denied) {
      return denied;
    }
    const ran = await runMotionBatch(db, scope, ops.data.ops, body.data.version);
    if (ran.outcome !== ToolRun.Done) {
      return json({ error: ran.outcome, ...ran, outcome: undefined }, { status: STATUS_OF[ran.outcome] });
    }
    return json({ tool: BATCH, version: ran.version, saved: ran.saved, output: ran.output });
  }

  const denied = await gated([body.data.tool]);
  if (denied) {
    return denied;
  }

  const run = await runMotionTool(db, scope, { tool: body.data.tool, input: body.data.input, version: body.data.version });
  if (run.outcome !== ToolRun.Done) {
    return json({ error: run.outcome, detail: run.detail }, { status: STATUS_OF[run.outcome] });
  }
  const refused = refusalOf(run.output);
  if (refused) {
    return json({ error: ToolRun.Refused, detail: refused, output: run.output }, { status: HTTP_UNPROCESSABLE });
  }
  return json({ tool: body.data.tool, version: run.version, saved: run.saved, output: run.output });
};
