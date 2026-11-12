import { json } from '@sveltejs/kit';
import { routesFound } from '$lib/server/code-import/canvas-import';
import { MAX_ROUTES } from '$lib/server/code-import/repo';
import { ROUTES_STATUS } from '$lib/server/code-import/routes-found';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

const BAD_REQUEST = 400;
const MAX_SOURCE = 1000;
const MAX_APP = 200;

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const query = event.url.searchParams;
  const [repo, folder, upload, app] = ['repo', 'folder', 'upload', 'app'].map((k) => query.get(k) ?? undefined);
  const source = repo ?? folder ?? upload;
  if (!source || source.length > MAX_SOURCE || (app?.length ?? 0) > MAX_APP) {
    return json({ error: 'invalid' }, { status: BAD_REQUEST });
  }

  const found = await routesFound({ ...scope, actor: { kind: 'user', id: scope.userId } }, { ...(repo ? { repo } : upload ? { upload } : { folder }), app });
  if (!found.ok) {
    return json({ error: found.error, detail: found.detail, ...(found.apps.length ? { apps: found.apps } : {}) }, { status: ROUTES_STATUS[found.error] });
  }
  return json({ framework: found.framework, app: found.app, max: MAX_ROUTES, routes: found.routes });
};
