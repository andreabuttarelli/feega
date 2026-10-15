import { json } from '@sveltejs/kit';
import { reachableCaller } from '$lib/server/org-data/reach';
import { motionSummary } from '$lib/server/motion/ask';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, url }) => {
  const caller = await reachableCaller(request, url, { nodes: [params.nodeId ?? ''] });
  if (caller instanceof Response) {
    return caller;
  }

  const summary = await motionSummary(caller.db, { orgId: caller.orgId, nodeId: params.nodeId ?? '' });
  return summary instanceof Response ? summary : json(summary);
};
