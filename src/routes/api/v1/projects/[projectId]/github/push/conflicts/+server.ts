import { z } from 'zod';
import { projectScopeOf, type ProjectScope } from '$lib/server/projects/project-scope';
import { ConflictChoice, frameConflicts, frameResolve } from '$lib/server/code-push/conflicts';
import { framesDeps } from '$lib/server/code-push/frames-runtime';
import { answer, invalid } from '$lib/server/code-push/push-http';
import type { RequestHandler } from './$types';

const resolveBody = z.object({ nodeId: z.string().min(1), choice: z.enum(ConflictChoice) });

const userScope = (scope: ProjectScope) => ({ ...scope, actor: { kind: 'user' as const, id: scope.userId } });

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const nodeId = event.url.searchParams.get('nodeId');
  if (!nodeId) {
    return invalid();
  }
  return answer(await frameConflicts(framesDeps(scope.db, scope), userScope(scope), nodeId));
};

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = resolveBody.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return invalid();
  }
  return answer(await frameResolve(framesDeps(scope.db, scope), userScope(scope), ask.data.nodeId, ask.data.choice));
};
