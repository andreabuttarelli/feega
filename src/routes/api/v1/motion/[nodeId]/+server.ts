import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { motionSummary } from '$lib/server/motion/ask';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  const summary = await motionSummary(resolved.caller.db, { orgId: resolved.caller.orgId, nodeId: params.nodeId ?? '' });
  return summary instanceof Response ? summary : json(summary);
};
