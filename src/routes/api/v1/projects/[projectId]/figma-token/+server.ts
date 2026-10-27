import { json } from '@sveltejs/kit';
import { figmaTokenStore } from '$lib/server/figma/token-store';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const token = await figmaTokenStore(scope.db, scope.userId).read();
  return json({ connected: token !== null });
};
