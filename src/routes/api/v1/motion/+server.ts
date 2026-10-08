import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { listMotionVideos } from '$lib/server/motion/agent-videos';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  const { db, orgId } = resolved.caller;
  return json({ videos: await listMotionVideos(db, { orgId, projectId: url.searchParams.get('project') }) });
};
