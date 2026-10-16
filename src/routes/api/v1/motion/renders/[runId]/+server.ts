import { json } from '@sveltejs/kit';
import { reachableCaller } from '$lib/server/org-data/reach';
import { renderState } from '$lib/server/motion/agent-render';
import type { RequestHandler } from './$types';

const HTTP_NOT_FOUND = 404;

export const GET: RequestHandler = async ({ request, params, url }) => {
  const caller = await reachableCaller(request, url, { runs: [params.runId ?? ''] });
  if (caller instanceof Response) {
    return caller;
  }

  const state = await renderState(caller.db, { orgId: caller.orgId, runId: params.runId ?? '' });
  return state.ok ? json(state.body) : json({ error: state.error }, { status: HTTP_NOT_FOUND });
};
