import { json } from '@sveltejs/kit';
import { reachableCaller } from '$lib/server/org-data/reach';
import { askStatus } from '$lib/server/motion/ask';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, url }) => {
  const caller = await reachableCaller(request, url, { runs: [params.runId ?? ''] });
  if (caller instanceof Response) {
    return caller;
  }

  const status = await askStatus(caller.db, { orgId: caller.orgId, runId: params.runId ?? '' });
  return status instanceof Response ? status : json(status);
};
