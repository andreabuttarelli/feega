import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { signedInDb } from '$lib/server/dashboard/app-shell';
import { DASHBOARD_DEPS, videoPage } from '$lib/server/dashboard/dashboard';
import { listMemberships } from '$lib/server/repos/orgs';
import { chooseOrg, ORG_COOKIE } from '$lib/server/tenancy/context';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

export const GET: RequestHandler = async (event) => {
  const before = event.url.searchParams.get('before');
  if (!before) {
    throw error(HTTP_BAD_REQUEST, 'Missing cursor');
  }

  const { db, user } = await signedInDb(event);
  const membership = chooseOrg(await listMemberships(db, user.id), event.cookies.get(ORG_COOKIE) ?? null);
  if (!membership) {
    throw error(HTTP_NOT_FOUND, 'No workspace');
  }

  return json(await videoPage(db, DASHBOARD_DEPS, membership.org.id, before));
};
