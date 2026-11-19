import { z } from 'zod';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { frameCheckout } from '$lib/server/code-push/frames-push';
import { framesDeps } from '$lib/server/code-push/frames-runtime';
import { answer, invalid } from '$lib/server/code-push/push-http';
import type { RequestHandler } from './$types';

const MAX_FRAMES = 50;
const BRANCH = z.string().min(1).max(200).regex(/^(?!.*\.\.)[\w./-]+$/);

const branchBody = z.object({ nodeIds: z.array(z.string().min(1)).min(1).max(MAX_FRAMES), branch: BRANCH, from: BRANCH.optional() });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = branchBody.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return invalid();
  }
  return answer(await frameCheckout(framesDeps(scope.db, scope), ask.data));
};
