import { z } from 'zod';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { frameReady } from '$lib/server/code-push/frames-push';
import { framesDeps } from '$lib/server/code-push/frames-runtime';
import { answer, invalid } from '$lib/server/code-push/push-http';
import type { RequestHandler } from './$types';

const readyBody = z.object({ nodeId: z.string().min(1) });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = readyBody.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return invalid();
  }
  return answer(await frameReady(framesDeps(scope.db, scope), ask.data.nodeId));
};
