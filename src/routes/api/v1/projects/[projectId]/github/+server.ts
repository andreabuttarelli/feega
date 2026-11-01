import { json } from '@sveltejs/kit';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { githubFor } from '$lib/server/code-import/github-runtime';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  return json(await githubFor(scope.db, scope).status());
};

export const DELETE: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  await githubFor(scope.db, scope).disconnect();
  return json({ connected: false });
};
