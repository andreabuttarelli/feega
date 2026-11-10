import { error } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { openCanvasForUser } from '$lib/server/canvas/lookup';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { motionTokens } from '$lib/server/motion/editor';
import { motionSources } from '$lib/server/motion/sources';
import { MEDIA_UUID_RE } from '$lib/media-url';
import { revalidated } from '$lib/server/revalidated';
import { serverTiming } from '$lib/server/server-timing';

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const MAX_FRAMES = 100;

const askSchema = z.object({ ids: z.array(z.string().regex(MEDIA_UUID_RE)).min(1).max(MAX_FRAMES) });

export const GET: RequestHandler = async ({ locals, params, request, url }) => {
  const ask = askSchema.safeParse({ ids: (url.searchParams.get('ids') ?? '').split(',').filter(Boolean) });
  if (!ask.success) {
    throw error(HTTP_BAD_REQUEST, 'Send ?ids=<node id>,<node id>');
  }

  const phases = serverTiming();
  const { user } = await phases.time('auth', locals.safeGetSession());
  const db = await locals.db();
  if (!user || !db) {
    throw error(HTTP_UNAUTHORIZED, 'Sign in first');
  }

  const { found } = await phases.time('canvas', openCanvasForUser(db, { userId: user.id, canvasId: params.canvasId }));
  if (!found || found.canvas.projectId !== params.projectId || !(await canvasReachable(db, found, user.id))) {
    throw error(HTTP_NOT_FOUND, 'This canvas does not exist, or is not yours');
  }

  const scope = { db, orgId: found.orgId, projectId: params.projectId, canvasId: found.canvas.id };
  const [sources, tokens] = await Promise.all([
    motionSources({ ...scope, nodeIds: [...new Set(ask.data.ids)], phases }),
    phases.time('tokens', motionTokens(db, { orgId: found.orgId, brandId: found.projectBrandId }))
  ]);
  return revalidated(request, phases.span('stringify', () => JSON.stringify({ tokens, frames: Object.fromEntries(sources.frames), signed: sources.signed })), phases);
};
