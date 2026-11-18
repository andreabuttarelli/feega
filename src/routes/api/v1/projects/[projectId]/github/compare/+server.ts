import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { frameCompare, MAX_VERSIONS } from '$lib/server/code-push/frames-compare';
import { httpStatusOf } from '$lib/server/code-push/frames-push';
import { invalid } from '$lib/server/code-push/push-http';
import { compareDeps } from '$lib/server/code-push/compare-runtime';
import type { RequestHandler } from './$types';

const compareBody = z.object({
  nodeId: z.string().min(1),
  refs: z.array(z.string().min(1).max(200)).min(1).max(MAX_VERSIONS)
});

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = compareBody.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return invalid();
  }
  const out = await frameCompare(compareDeps(scope.db, { ...scope, actor: { kind: 'user', id: scope.userId } }), ask.data);
  return out.ok ? json(out) : json(out, { status: httpStatusOf(out.refusal) });
};
