import { error, json } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from './$types';
import { listMemberships } from '$lib/server/repos/orgs';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { cardPreviews, saveCardPreview } from '$lib/server/canvas/card-previews';

const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const PREVIEW_MAX_BYTES = 2_000_000;
const PREVIEW_TYPE = 'image/webp';

async function canvasOf({ locals, params }: Pick<RequestEvent, 'locals' | 'params'>) {
  const { user } = await locals.safeGetSession();
  const db = await locals.db();
  if (!user || !db) {
    throw error(HTTP_UNAUTHORIZED, 'Sign in first');
  }
  const found = await findCanvasForUser(db, { canvasId: params.canvasId, memberships: await listMemberships(db, user.id) });
  if (!found || found.canvas.projectId !== params.projectId || !(await canvasReachable(db, found, user.id))) {
    throw error(HTTP_NOT_FOUND, 'This canvas does not exist, or is not yours');
  }
  return { db, scope: { orgId: found.orgId, projectId: params.projectId } };
}

export const GET: RequestHandler = async (event) => {
  const { db, scope } = await canvasOf(event);
  return json(await cardPreviews(db, scope));
};

export const POST: RequestHandler = async (event) => {
  const { db, scope } = await canvasOf(event);
  const form = await event.request.formData();
  const file = form.get('file');
  const nodeId = String(form.get('nodeId') ?? '');
  const hash = String(form.get('hash') ?? '');
  if (!(file instanceof File) || file.type !== PREVIEW_TYPE || !file.size || file.size > PREVIEW_MAX_BYTES) {
    throw error(HTTP_BAD_REQUEST, 'A card preview is a webp under 2 MB');
  }
  await saveCardPreview(db, { ...scope, nodeId, hash, file }).catch(() => {
    throw error(HTTP_BAD_REQUEST, 'This card preview could not be stored');
  });
  return new Response(null, { status: HTTP_NO_CONTENT });
};
