import { json } from '@sveltejs/kit';
import { isCloudProvider } from '$lib/server/cloud/cloud';
import { disconnectCloud } from '$lib/server/cloud/runtime';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

const HTTP_NOT_FOUND = 404;

export const DELETE: RequestHandler = async (event) => {
  if (!isCloudProvider(event.params.provider)) {
    return json({ error: 'unknown_provider' }, { status: HTTP_NOT_FOUND });
  }
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const { revoked } = await disconnectCloud(scope.db, scope.userId, event.params.provider);
  return json({ disconnected: true, revoked });
};
