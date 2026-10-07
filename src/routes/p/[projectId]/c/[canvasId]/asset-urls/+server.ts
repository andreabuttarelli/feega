import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listMemberships } from '$lib/server/repos/orgs';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { assetsById } from '$lib/server/motion/editor';
import { ASSET_IDS_PARAM } from '$lib/canvas/composition-node';

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const { user } = await locals.safeGetSession();
  const db = await locals.db();
  if (!user || !db) {
    throw error(HTTP_UNAUTHORIZED, 'Sign in first');
  }

  const found = await findCanvasForUser(db, { canvasId: params.canvasId, memberships: await listMemberships(db, user.id) });
  if (!found || found.canvas.projectId !== params.projectId || !(await canvasReachable(db, found, user.id))) {
    throw error(HTTP_NOT_FOUND, 'This canvas does not exist, or is not yours');
  }

  const ids = (url.searchParams.get(ASSET_IDS_PARAM) ?? '').split(',').filter(Boolean);
  return json(await assetsById({ db, orgId: found.orgId, projectId: params.projectId, canvasId: found.canvas.id }, ids));
};
