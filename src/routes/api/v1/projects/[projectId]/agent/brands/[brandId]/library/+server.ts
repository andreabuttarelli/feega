import { json } from '@sveltejs/kit';
import { listMemberships } from '$lib/server/repos/orgs';
import { findReachableProject } from '$lib/server/projects/lookup';
import { LIBRARY_LOADERS, brandExists } from '$lib/server/brand-library';
import type { LibraryTab } from '$lib/canvas/brand-library';
import type { RequestHandler } from './$types';

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const SERVER_ERROR = 500;

export const GET: RequestHandler = async ({ params, locals, url }) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'unauthenticated' }, { status: UNAUTHORIZED });
  }

  const load = LIBRARY_LOADERS[url.searchParams.get('tab') as LibraryTab];
  if (!load) {
    return json({ error: 'unknown_tab' }, { status: BAD_REQUEST });
  }

  const db = await locals.db();
  if (!db) {
    return json({ error: 'no_client' }, { status: SERVER_ERROR });
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findReachableProject(db, { projectId: params.projectId ?? '', memberships, userId: user.id });
  if (!found) {
    return json({ error: 'project_not_found' }, { status: NOT_FOUND });
  }

  const scope = { orgId: found.orgId, brandId: params.brandId ?? '' };
  if (!(await brandExists(db, scope))) {
    return json({ error: 'brand_not_found' }, { status: NOT_FOUND });
  }

  return json({ items: await load(db, scope) });
};
