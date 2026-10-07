import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { renderState } from '$lib/server/motion/agent-render';
import type { RequestHandler } from './$types';

const HTTP_NOT_FOUND = 404;

export const GET: RequestHandler = async ({ request, params, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  const state = await renderState(resolved.caller.db, { orgId: resolved.caller.orgId, runId: params.runId ?? '' });
  return state.ok ? json(state.body) : json({ error: state.error }, { status: HTTP_NOT_FOUND });
};
