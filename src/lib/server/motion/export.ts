import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { insertAsset } from '$lib/server/repos/assets';
import { DataCheck, patchNodeData } from '$lib/server/repos/canvas';
import { DIGITAL_SOURCE_TYPE, markGenerated } from '$lib/server/content-credentials';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { exportFolder, type ExportScope } from '$lib/motion/export-plan';

const MP4_MIME = 'video/mp4';
const MP4_FILE = /^[\w-]+\.mp4$/;
const MARKED_SUFFIX = '-cc.mp4';

export type ExportInput = ExportScope & { actor: Actor; path: string; width: number; height: number; seconds: number };
export type ExportSaved = { ok: true; assetId: string } | { ok: false; error: string };

function inFolder(scope: ExportScope, path: string): boolean {
  const folder = exportFolder(scope);
  return path.startsWith(folder) && MP4_FILE.test(path.slice(folder.length));
}

export async function saveExport(db: Db, input: ExportInput): Promise<ExportSaved> {
  if (!inFolder(input, input.path)) {
    return { ok: false, error: 'invalid_path' };
  }

  const bucket = db.storage.from(CANVAS_ASSET_BUCKET);
  const download = await bucket.download(input.path);
  if (download.error || !download.data) {
    return { ok: false, error: 'file_not_found' };
  }

  const original = Buffer.from(await download.data.arrayBuffer());
  const mark = await markGenerated(original, MP4_MIME, { model: null, provider: null, sourceType: DIGITAL_SOURCE_TYPE.composite });
  const path = mark.marked ? input.path.replace(/\.mp4$/, MARKED_SUFFIX) : input.path;
  if (mark.marked) {
    const upload = await bucket.upload(path, mark.bytes, { contentType: MP4_MIME, upsert: false });
    if (upload.error) {
      return { ok: false, error: `store_failed: ${upload.error.message}` };
    }
    await bucket.remove([input.path]);
  }

  const asset = await insertAsset(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    type: 'video',
    source: 'upload',
    url: path,
    mimeType: MP4_MIME,
    bytes: mark.bytes.length,
    width: input.width,
    height: input.height,
    durationS: input.seconds,
    sourceNodeId: input.nodeId,
    aiMarked: mark.marked
  });

  await patchNodeData(db, { orgId: input.orgId, nodeId: input.nodeId, patch: { lastRenderAssetId: asset.id }, check: DataCheck.Schema, actor: input.actor });
  return { ok: true, assetId: asset.id };
}
