import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { ViewOp, runView } from '$lib/server/edit/run-view';

const QUERY_INPUT: Record<string, string> = { author: 'author', frame: 'frame_id' };
const LIMIT_PARAM = 'limit';

function inputOf(canvasId: string, params: URLSearchParams): Record<string, unknown> {
  const fields = Object.entries(QUERY_INPUT).flatMap(([param, field]) => {
    const value = params.get(param);
    return value ? [[field, value]] : [];
  });
  const limit = params.get(LIMIT_PARAM);
  return { canvas_id: canvasId, ...Object.fromEntries(fields), ...(limit ? { limit: Number(limit) } : {}) };
}

export const GET: RequestHandler = async ({ request, url, params }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const org = url.searchParams.get('org') ?? undefined;
  const resolved = await resolveOrgCaller(bearer, org);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  const answer = await runView(resolved.caller, ViewOp.ListHistory, inputOf(params.canvasId, url.searchParams), { bearer: bearer ?? '', ownOrigin: url.origin, org });
  return json(answer.body, { status: answer.status });
};
