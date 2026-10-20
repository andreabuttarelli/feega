import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { CANVAS_OPS, isCanvasOp } from '$lib/server/canvas/canvas-ops';
import { CANVAS_OP_SUMMARIES } from '$lib/server/canvas/canvas-op-summaries';
import { describeOps } from '$lib/server/ops-description';
import { runCanvasOp } from '$lib/server/edit/runners';

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const DESCRIBE_OP = 'describe';

const describeInput = z.object({ op: z.string().optional() }).strict();

export const POST: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  const { caller } = resolved;

  const body = (await request.json().catch(() => ({}))) as { project_id?: string; op?: string; input?: unknown };
  const name = body.op ?? '';
  if (name === DESCRIBE_OP) {
    const asked = describeInput.safeParse(body.input ?? {});
    if (!asked.success) {
      return json({ error: 'invalid_input', issues: asked.error.issues }, { status: HTTP_BAD_REQUEST });
    }
    const described = describeOps(CANVAS_OPS, CANVAS_OP_SUMMARIES, asked.data.op);
    return json(described, { status: 'error' in described ? HTTP_BAD_REQUEST : HTTP_OK });
  }
  if (!isCanvasOp(name)) {
    return json(describeOps(CANVAS_OPS, CANVAS_OP_SUMMARIES, name), { status: HTTP_BAD_REQUEST });
  }

  const answer = await runCanvasOp(caller, { projectId: body.project_id ?? '', op: name, input: body.input });
  return json(answer.body, { status: answer.status });
};
