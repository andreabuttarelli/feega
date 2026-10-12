import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { listTemplates } from '$lib/server/motion/template-api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  return json(await listTemplates(resolved.caller.db, { orgId: resolved.caller.orgId, userId: resolved.caller.userId }));
};
