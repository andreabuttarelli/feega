import { json } from '@sveltejs/kit';
import { Toolkit } from '$lib/server/connections/account-links';
import { accountFor } from '$lib/server/connections/runtime';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const { connected } = await accountFor(scope.db, scope, Toolkit.Figma).status();
  return json({ connected });
};
