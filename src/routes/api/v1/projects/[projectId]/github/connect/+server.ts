import { json } from '@sveltejs/kit';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { githubFor } from '$lib/server/code-import/github-runtime';
import { GithubRefusal, localPath, refused } from '$lib/server/code-import/github-http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const body = (await event.request.json().catch(() => ({}))) as { returnTo?: string };
  const started = await githubFor(scope.db, scope).connect(event.url.origin, localPath(body.returnTo));
  return started ? json(started) : refused(GithubRefusal.NotConfigured);
};
