import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { openCanvasForUser } from '$lib/server/canvas/lookup';
import { runCanvasOp } from '$lib/server/edit/runners';

const HTTP_NOT_FOUND = 404;

export const POST: RequestHandler = async ({ request, url, params }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  const { caller } = resolved;

  const { found } = await openCanvasForUser(caller.db, { userId: caller.userId, canvasId: params.canvasId });
  if (!found || found.orgId !== caller.orgId) {
    return json({ error: 'canvas_not_found' }, { status: HTTP_NOT_FOUND });
  }

  const body = (await request.json().catch(() => ({}))) as { keep?: string };
  const answer = await runCanvasOp(caller, { projectId: found.canvas.projectId, op: 'resolve_conflict', input: { canvasId: params.canvasId, conflictId: params.conflictId, keep: body.keep } });
  return json(answer.body, { status: answer.status });
};
