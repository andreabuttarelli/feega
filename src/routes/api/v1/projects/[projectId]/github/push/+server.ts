import { z } from 'zod';
import { projectScopeOf, type ProjectScope } from '$lib/server/projects/project-scope';
import { framesPush, frameStatus } from '$lib/server/code-push/frames-push';
import { answer, invalid } from '$lib/server/code-push/push-http';
import { framesDeps } from '$lib/server/code-push/frames-runtime';
import type { RequestHandler } from './$types';

const MAX_FRAMES = 50;
const SHA = z.string().min(7).max(64);

const pushBody = z.object({
  name: z.string().min(1).max(100),
  nodeIds: z.array(z.string().min(1)).min(1).max(MAX_FRAMES),
  title: z.string().max(200).optional(),
  body: z.string().max(10_000).optional(),
  since: z.object({ branch: z.string().max(200), sha: SHA }).optional(),
  base: z.string().max(200).optional(),
  confirmSensitive: z.boolean().optional()
});

const userScope = (scope: ProjectScope) => ({ ...scope, actor: { kind: 'user' as const, id: scope.userId } });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = pushBody.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return invalid();
  }
  return answer(await framesPush(framesDeps(scope.db, scope), userScope(scope), ask.data));
};

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const nodeId = event.url.searchParams.get('nodeId');
  if (!nodeId) {
    return invalid();
  }
  return answer(await frameStatus(framesDeps(scope.db, scope), userScope(scope), nodeId));
};
