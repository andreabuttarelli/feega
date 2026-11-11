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

const askSchema = z.object({
  ids: z.array(z.string().regex(MEDIA_UUID_RE)).min(1).max(MAX_FRAMES),
  org: z.string().min(1).max(64).optional(),
  at: z.array(z.coerce.number().int().positive()).optional()
});

const heldOf = (ids: string[], at: number[] | undefined): Map<string, number> => new Map(at?.length === ids.length ? ids.map((id, i) => [id, at[i]]) : []);

export const GET: RequestHandler = async ({ locals, params, request, url }) => {
  const list = (name: string) => (url.searchParams.get(name) ?? '').split(',').filter(Boolean);
  const ask = askSchema.safeParse({ ids: list('ids'), org: url.searchParams.get('org') ?? undefined, at: url.searchParams.has('at') ? list('at') : undefined });
  if (!ask.success) {
    throw error(HTTP_BAD_REQUEST, 'Send ?ids=<node id>,<node id>');
  }

  const phases = serverTiming();
  const { user } = await phases.time('auth', locals.safeGetSession());
  const db = await locals.db();
  if (!user || !db) {
    throw error(HTTP_UNAUTHORIZED, 'Sign in first');
  }

  const checked = phases.time('canvas', (async () => {
    const { found } = await openCanvasForUser(db, { userId: user.id, canvasId: params.canvasId });
    return found && found.canvas.projectId === params.projectId && (await canvasReachable(db, found, user.id)) ? found : null;
  })());
  const ids = [...new Set(ask.data.ids)];
  const read = (orgId: string) => motionSources({ db, orgId, projectId: params.projectId, canvasId: params.canvasId, nodeIds: ids, held: heldOf(ask.data.ids, ask.data.at), phases });
  const early = ask.data.org ? read(ask.data.org) : null;
  early?.catch(() => null);

  const found = await checked;
  if (!found || (ask.data.org && ask.data.org !== found.orgId)) {
    throw error(HTTP_NOT_FOUND, 'This canvas does not exist, or is not yours');
  }

  const [sources, tokens] = await Promise.all([early ?? read(found.orgId), phases.time('tokens', motionTokens(db, { orgId: found.orgId, brandId: found.projectBrandId }))]);
  return revalidated(request, phases.span('stringify', () => JSON.stringify({ tokens, frames: Object.fromEntries(sources.frames), signed: sources.signed })), phases);
};
