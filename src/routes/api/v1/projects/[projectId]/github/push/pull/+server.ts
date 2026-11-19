import { z } from 'zod';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { framePull } from '$lib/server/code-push/frames-push';
import { framesDeps } from '$lib/server/code-push/frames-runtime';
import { answer, invalid } from '$lib/server/code-push/push-http';
import { PullKind } from '$lib/server/code-push/push';
import type { RequestHandler } from './$types';

const pullBody = z.object({ nodeId: z.string().min(1), base: z.string().min(1).max(200).optional(), title: z.string().max(200).optional(), body: z.string().max(10_000).optional(), kind: z.enum(PullKind).optional() });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = pullBody.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return invalid();
  }
  return answer(await framePull(framesDeps(scope.db, scope), ask.data));
};
