import type { RequestHandler } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { listMemberships } from '$lib/server/repos/orgs';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { CANVAS_REDIRECT_MAX_AGE_S, signAssetFile } from '$lib/server/repos/asset-storage';
import { webViewPrefix } from '$lib/server/web/live';

const SEGMENT = /^[\w-]+(\.jpg)?$/;

export const GET: RequestHandler = async ({ params, locals }) => {
  const { session, user } = await locals.safeGetSession();
  if (!session || !user) {
    throw redirect(303, '/login');
  }
  if (!SEGMENT.test(params.callId ?? '') || !SEGMENT.test(params.file ?? '')) {
    throw error(404, 'Not found');
  }

  const db = await locals.db();
  if (!db) {
    throw error(500, 'no session client');
  }
  const found = await findCanvasForUser(db, { canvasId: params.canvasId ?? '', memberships: await listMemberships(db, user.id) });
  if (!found || found.canvas.projectId !== params.projectId || !(await canvasReachable(db, found, user.id))) {
    throw error(404, 'This canvas does not exist, or is not yours');
  }

  const signed = await signAssetFile(db, `${webViewPrefix({ orgId: found.orgId, projectId: params.projectId }, params.callId)}/${params.file}`).catch(() => null);
  if (!signed) {
    throw error(404, 'File not found');
  }
  return new Response(null, { status: 302, headers: { Location: signed, 'Cache-Control': `private, max-age=${CANVAS_REDIRECT_MAX_AGE_S}` } });
};
