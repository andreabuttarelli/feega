import { createHash } from 'node:crypto';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listMemberships } from '$lib/server/repos/orgs';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { findMotionNode, motionTokens } from '$lib/server/motion/editor';
import { listProjects } from '$lib/server/repos/projects';
import { motionSource } from '$lib/server/motion/sources';
import { MEDIA_UUID_RE } from '$lib/media-url';

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_MODIFIED = 304;
const REVALIDATE = 'private, no-cache';

function revalidated(request: Request, body: string): Response {
  const tag = `"${createHash('sha1').update(body).digest('base64url')}"`;
  const headers = { etag: tag, 'cache-control': REVALIDATE };
  if (request.headers.get('if-none-match') === tag) {
    return new Response(null, { status: HTTP_NOT_MODIFIED, headers });
  }
  return new Response(body, { headers: { ...headers, 'content-type': 'application/json' } });
}

export const GET: RequestHandler = async ({ locals, params, request }) => {
  if (!MEDIA_UUID_RE.test(params.nodeId)) {
    throw error(HTTP_BAD_REQUEST, 'Not a node id');
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

  const motion = await findMotionNode(db, { orgId: found.orgId, nodeId: params.nodeId, place: { canvasId: found.canvas.id } });
  if (!motion) {
    throw error(HTTP_NOT_FOUND, 'This motion editor has nothing to show');
  }
  const source = await motionSource({ db, orgId: found.orgId, projectId: params.projectId, canvasId: found.canvas.id, nodeId: params.nodeId });
  if (!source) {
    return new Response(null, { status: HTTP_NO_CONTENT });
  }
  const brandId = (await listProjects(db, found.orgId)).find((p) => p.id === params.projectId)?.brandId ?? null;
  return revalidated(request, JSON.stringify({ ...source, tokens: await motionTokens(db, { orgId: found.orgId, brandId }) }));
};
