import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listMemberships } from '$lib/server/repos/orgs';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { listNodeRuns } from '$lib/server/repos/node-runs';
import { findAsset } from '$lib/server/repos/assets';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { batchView } from '$lib/server/motion/render-run';
import { batchZip } from '$lib/server/motion/batch-zip';

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;

export const GET: RequestHandler = async ({ locals, params }) => {
  const { user } = await locals.safeGetSession();
  const db = await locals.db();
  if (!user || !db) {
    throw error(HTTP_UNAUTHORIZED, 'Sign in first');
  }

  const found = await findCanvasForUser(db, { canvasId: params.canvasId, memberships: await listMemberships(db, user.id) });
  if (!found || found.canvas.projectId !== params.projectId) {
    throw error(HTTP_NOT_FOUND, 'This canvas does not exist, or is not yours');
  }

  const view = batchView(await listNodeRuns(db, { orgId: found.orgId, nodeId: params.nodeId }));
  if (!view || view.id !== params.batchId) {
    throw error(HTTP_NOT_FOUND, 'This batch does not exist');
  }

  const bucket = db.storage.from(CANVAS_ASSET_BUCKET);
  const stream = batchZip(view, {
    path: async (assetId) => (await findAsset(db, { orgId: found.orgId, assetId }))?.url ?? null,
    bytes: async (path) => {
      const { data, error: failed } = await bucket.download(path);
      if (failed || !data) {
        throw new Error(`download failed: ${path}`);
      }
      return new Uint8Array(await data.arrayBuffer());
    }
  });
  return new Response(stream, { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="batch-${view.id.slice(0, 8)}.zip"` } });
};
