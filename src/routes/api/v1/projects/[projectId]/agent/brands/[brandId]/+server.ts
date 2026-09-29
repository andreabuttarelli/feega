import { json } from '@sveltejs/kit';
import { listMemberships } from '$lib/server/repos/orgs';
import { findReachableProject } from '$lib/server/projects/lookup';
import { loadBrandDetails } from '$lib/server/brand-details';
import type { RequestHandler } from './$types';

const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const SERVER_ERROR = 500;

export const GET: RequestHandler = async ({ params, locals }) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'unauthenticated' }, { status: UNAUTHORIZED });
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

  const details = await loadBrandDetails(db, { orgId: found.orgId, brandId: params.brandId ?? '' });
  if (!details) {
    return json({ error: 'brand_not_found' }, { status: NOT_FOUND });
  }

  return json({ details });
};
