import { json } from '@sveltejs/kit';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { githubFor } from '$lib/server/code-import/github-runtime';
import { missingLink, refused } from '$lib/server/code-import/github-http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const github = githubFor(scope.db, scope);
  const missing = missingLink(await github.status());
  if (missing) {
    return refused(missing);
  }
  return json({ repos: (await github.repos()) ?? [] });
};
