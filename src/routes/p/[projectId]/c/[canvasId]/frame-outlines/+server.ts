import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listMemberships } from '$lib/server/repos/orgs';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { frameOutlines } from '$lib/server/motion/frame-outlines';
import { HEADS_PARAM, parseHeads } from '$lib/canvas/frame-outlines';

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

  return json(await frameOutlines(db, { orgId: found.orgId, heads: parseHeads(url.searchParams.get(HEADS_PARAM) ?? '') }));
};
