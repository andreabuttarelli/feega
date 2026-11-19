import { json } from '@sveltejs/kit';
import { isCloudProvider, labelOf, listFiles } from '$lib/server/cloud/cloud';
import { CLOUD_REFUSAL_STATUS, cloudAccess } from '$lib/server/cloud/runtime';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

const HTTP_NOT_FOUND = 404;

export const GET: RequestHandler = async (event) => {
  if (!isCloudProvider(event.params.provider)) {
    return json({ error: 'unknown_provider' }, { status: HTTP_NOT_FOUND });
  }
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const access = await cloudAccess(scope.db, scope, event.params.provider);
  if (!access.ok) {
    return json({ error: access.reason, provider: event.params.provider, label: labelOf(event.params.provider) }, { status: CLOUD_REFUSAL_STATUS[access.reason] });
  }
  const page = await listFiles(event.params.provider, access.call, event.url.searchParams.get('folder'), event.url.searchParams.get('cursor'));
  return json(page);
};
