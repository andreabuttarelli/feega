import { z } from 'zod';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { VersionAction, versionAction } from '$lib/server/code-push/frames-version-actions';
import { answer, invalid } from '$lib/server/code-push/push-http';
import { actionDeps } from '$lib/server/code-push/compare-runtime';
import type { RequestHandler } from './$types';

const actionBody = z.object({ versionId: z.string().min(1), action: z.enum(VersionAction) });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = actionBody.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return invalid();
  }
  return answer(await versionAction(actionDeps(scope.db, { ...scope, actor: { kind: 'user', id: scope.userId } }), ask.data.action, ask.data.versionId));
};
