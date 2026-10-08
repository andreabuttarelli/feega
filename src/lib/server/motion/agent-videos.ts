import type { Db } from '$lib/server/db/client';
import { listMotionNodes } from '$lib/server/repos/canvas';
import { findAssets } from '$lib/server/repos/assets';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { motionEditorPath, motionOf } from '$lib/canvas/motion-node';

const PREVIEW_URL_TTL_S = 60 * 60;

export type MotionVideo = {
  node_id: string;
  name: string | null;
  project_id: string;
  canvas_id: string;
  format: string;
  version: number;
  poster_url: string | null;
  last_render_url: string | null;
  editor_url: string;
};

async function signer(db: Db, orgId: string, assetIds: string[]): Promise<(id: string | null) => string | null> {
  const assets = await findAssets(db, { orgId, assetIds });
  const bucket = db.storage.from(CANVAS_ASSET_BUCKET);
  const signed = new Map<string, string>();
  for (const asset of assets.values()) {
    const { data } = asset.url ? await bucket.createSignedUrl(asset.url, PREVIEW_URL_TTL_S) : { data: null };
    if (data?.signedUrl) {
      signed.set(asset.id, data.signedUrl);
    }
  }
  return (id) => (id ? (signed.get(id) ?? null) : null);
}

export async function listMotionVideos(db: Db, scope: { orgId: string; projectId: string | null }): Promise<MotionVideo[]> {
  const motions = (await listMotionNodes(db, scope)).flatMap((record) => {
    const node = motionOf(record);
    return node ? [{ record, node }] : [];
  });
  const assetIds = motions.flatMap(({ node }) => [node.posterAssetId, node.lastRenderAssetId]).filter((id): id is string => Boolean(id));
  const signedUrl = await signer(db, scope.orgId, assetIds);

  return motions.map(({ record, node }) => ({
    node_id: record.id,
    name: record.displayName,
    project_id: record.projectId,
    canvas_id: record.canvasId,
    format: node.format,
    version: node.docHeadRevision,
    poster_url: signedUrl(node.posterAssetId),
    last_render_url: signedUrl(node.lastRenderAssetId),
    editor_url: motionEditorPath({ projectId: record.projectId, canvasId: record.canvasId, nodeId: record.id })
  }));
}
