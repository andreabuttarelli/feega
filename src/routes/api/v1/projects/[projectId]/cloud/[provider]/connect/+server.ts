import { json } from '@sveltejs/kit';
import { isCloudProvider } from '$lib/server/cloud/cloud';
import { CLOUD_REFUSAL_STATUS, CloudRefusal, cloudAccount } from '$lib/server/cloud/runtime';
import { localPath } from '$lib/server/code-import/github-http';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

const HTTP_NOT_FOUND = 404;

export const POST: RequestHandler = async (event) => {
  if (!isCloudProvider(event.params.provider)) {
    return json({ error: 'unknown_provider' }, { status: HTTP_NOT_FOUND });
  }
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const body = (await event.request.json().catch(() => ({}))) as { returnTo?: string };
  const started = await cloudAccount(scope.db, scope, event.params.provider).connect(event.url.origin, localPath(body.returnTo));
  return started ? json(started) : json({ error: CloudRefusal.NotConfigured }, { status: CLOUD_REFUSAL_STATUS[CloudRefusal.NotConfigured] });
};
