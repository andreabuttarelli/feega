import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { ToolRun, runMotionTool } from '$lib/server/motion/tool-run';
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
  [ToolRun.Conflict]: HTTP_CONFLICT
};

const bodySchema = z.object({ tool: z.string().min(1), input: z.unknown().optional(), version: z.number().int().min(0).optional() });

export const POST: RequestHandler = async ({ request, params, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  const { db, orgId, userId, writeAllowed } = resolved.caller;
  if (!writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: ToolRun.Invalid, detail: body.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
  }

  const run = await runMotionTool(db, { orgId, userId, nodeId: params.nodeId ?? '' }, { tool: body.data.tool, input: body.data.input, version: body.data.version });
  if (run.outcome !== ToolRun.Done) {
    return json({ error: run.outcome, detail: run.detail }, { status: STATUS_OF[run.outcome] });
  }
  return json({ tool: body.data.tool, version: run.version, saved: run.saved, output: run.output });
};
