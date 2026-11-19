import { z } from 'zod';
import { projectScopeOf, type ProjectScope } from '$lib/server/projects/project-scope';
import { frameWip } from '$lib/server/code-push/frames-push';
import { framesDeps } from '$lib/server/code-push/frames-runtime';
import { answer, invalid } from '$lib/server/code-push/push-http';
import type { RequestHandler } from './$types';

const MAX_FRAMES = 50;

const wipBody = z.object({ nodeIds: z.array(z.string().min(1)).min(1).max(MAX_FRAMES) });

const userScope = (scope: ProjectScope) => ({ ...scope, actor: { kind: 'user' as const, id: scope.userId } });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = wipBody.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return invalid();
  }
  return answer(await frameWip(framesDeps(scope.db, scope), userScope(scope), ask.data.nodeIds));
};
