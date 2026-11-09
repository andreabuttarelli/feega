import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { listMemberships } from '$lib/server/repos/orgs';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { motionTokens } from '$lib/server/motion/editor';
import { motionSources } from '$lib/server/motion/sources';
import { MEDIA_UUID_RE } from '$lib/media-url';

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const MAX_FRAMES = 500;

const askSchema = z.object({ ids: z.array(z.string().regex(MEDIA_UUID_RE)).min(1).max(MAX_FRAMES) });

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const ask = askSchema.safeParse(await request.json().catch(() => null));
  if (!ask.success) {
    throw error(HTTP_BAD_REQUEST, 'Send { ids: [node ids] }');
  }

  const { user } = await locals.safeGetSession();
  const db = await locals.db();
  if (!user || !db) {
    throw error(HTTP_UNAUTHORIZED, 'Sign in first');
  }

  const found = await findCanvasForUser(db, { canvasId: params.canvasId, memberships: await listMemberships(db, user.id) });
  if (!found || found.canvas.projectId !== params.projectId || !(await canvasReachable(db, found, user.id))) {
    throw error(HTTP_NOT_FOUND, 'This canvas does not exist, or is not yours');
  }

  const scope = { db, orgId: found.orgId, projectId: params.projectId, canvasId: found.canvas.id };
  const [sources, tokens] = await Promise.all([motionSources({ ...scope, nodeIds: [...new Set(ask.data.ids)] }), motionTokens(db, { orgId: found.orgId, brandId: found.projectBrandId })]);
  return json({ tokens, frames: Object.fromEntries(sources) });
};
