import { z } from 'zod';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { variantDeps } from '$lib/server/code-push/frames-runtime';
import { answer, invalid } from '$lib/server/code-push/push-http';
import { frameVariant } from '$lib/server/code-push/variants';
import type { RequestHandler } from './$types';

const variantBody = z.object({ canvasId: z.string().min(1), nodeId: z.string().min(1) });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = variantBody.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return invalid();
  }
  return answer(await frameVariant(variantDeps(scope.db, scope, ask.data.canvasId), ask.data.nodeId));
};
