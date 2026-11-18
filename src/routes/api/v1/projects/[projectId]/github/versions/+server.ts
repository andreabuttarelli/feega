import { z } from 'zod';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { frameVersions } from '$lib/server/code-push/frames-versions';
import { answer, invalid } from '$lib/server/code-push/push-http';
import { framesDeps } from '$lib/server/code-push/frames-runtime';
import type { RequestHandler } from './$types';

const DEFAULT_COMMITS = 30;
const MAX_COMMITS = 100;

const versionsBody = z.object({
  nodeId: z.string().min(1),
  ref: z.string().min(1).max(200).optional(),
  limit: z.number().int().positive().max(MAX_COMMITS).default(DEFAULT_COMMITS)
});

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = versionsBody.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return invalid();
  }
  return answer(await frameVersions(framesDeps(scope.db, scope), ask.data));
};
