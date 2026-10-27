import { json } from '@sveltejs/kit';
import { cloudStatuses } from '$lib/server/cloud/runtime';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  return json({ providers: await cloudStatuses(scope.db, scope.userId) });
};
