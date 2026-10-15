import { json } from '@sveltejs/kit';
import { callerHidden, reachableCaller } from '$lib/server/org-data/reach';
import { listMotionVideos } from '$lib/server/motion/agent-videos';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
  const projectId = url.searchParams.get('project');
  const caller = await reachableCaller(request, url, { project: projectId });
  if (caller instanceof Response) {
    return caller;
  }

  const [videos, hidden] = await Promise.all([listMotionVideos(caller.db, { orgId: caller.orgId, projectId }), callerHidden(caller)]);
  return json({ videos: videos.filter((video) => !hidden.has(video.project_id)) });
};
