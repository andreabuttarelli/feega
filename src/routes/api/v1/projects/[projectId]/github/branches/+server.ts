import { json } from '@sveltejs/kit';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { githubFor } from '$lib/server/code-import/github-runtime';
import { GithubRefusal, missingLink, refused } from '$lib/server/code-import/github-http';
import { repoOf } from '$lib/server/code-import/repo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const repo = repoOf(`https://github.com/${event.url.searchParams.get('repo') ?? ''}`);
  if (!repo) {
    return refused(GithubRefusal.Invalid);
  }
  const github = githubFor(scope.db, scope);
  const missing = missingLink(await github.status());
  if (missing) {
    return refused(missing);
  }
  return json({ branches: (await github.branches(repo)) ?? [] });
};
