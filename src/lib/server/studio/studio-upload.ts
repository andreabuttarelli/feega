import type { Db } from '$lib/server/db/client';
import { createCanvas, createNode, DataCheck, listCanvases, listNodes, patchNodeData, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { registerUploadedAsset, UploadError } from '$lib/server/canvas/upload';
import { photoQuality, Severity, type PhotoFacts } from '$lib/studio/photo-quality';
import { isUploadsList, UPLOAD_ID_PREFIX, type UploadItem } from './studio-options';
import { signedAssets } from './studio-media';
import type { StudioCtx } from './studio-batch';

export const UPLOADS_CANVAS = 'Photo studio';
const UPLOADS_NODE = 'Product photos';

export type PhotoUpload = PhotoFacts & { path: string; fileName: string };

export type UploadOutcome = { product: { id: string; title: string; image: string | null } } | { error: string; status: 400 | 422 };

export function titleFromFile(fileName: string): string {
  const stem = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
  return stem ? stem[0].toUpperCase() + stem.slice(1) : 'My product';
}

async function findUploadsList(db: Db, ctx: StudioCtx): Promise<{ canvasId: string | null; node: CanvasNodeRecord | null }> {
  const canvases = (await listCanvases(db, ctx)).filter((c) => c.name === UPLOADS_CANVAS);
  for (const canvas of canvases) {
    const node = (await listNodes(db, { orgId: ctx.orgId, canvasId: canvas.id })).find(isUploadsList);
    if (node) {
      return { canvasId: canvas.id, node };
    }
  }
  return { canvasId: canvases[0]?.id ?? null, node: null };
}

async function addToUploads(db: Db, ctx: StudioCtx, item: UploadItem): Promise<void> {
  const found = await findUploadsList(db, ctx);
  if (found.node) {
    const items = [...((found.node.data.items ?? []) as UploadItem[]), item];
    await patchNodeData(db, { orgId: ctx.orgId, nodeId: found.node.id, patch: { items }, check: DataCheck.None });
    return;
  }

  const canvasId = found.canvasId ?? (await createCanvas(db, { ...ctx, name: UPLOADS_CANVAS })).id;
  await createNode(db, {
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    canvasId,
    type: 'list',
    x: 0,
    y: 0,
    displayName: UPLOADS_NODE,
    data: { item_kind: 'image', items: [item], studio_uploads: true }
  });
}

export async function addPhotoProduct(db: Db, ctx: StudioCtx, photo: PhotoUpload): Promise<UploadOutcome> {
  const blocking = photoQuality(photo).issues.find((i) => i.severity === Severity.Block);
  if (blocking) {
    return { error: `${blocking.problem} ${blocking.fix}`, status: 422 };
  }

  let assetId: string;
  try {
    const { asset } = await registerUploadedAsset(db, { orgId: ctx.orgId, projectId: ctx.projectId, path: photo.path, fileName: photo.fileName, mimeType: photo.mimeType, bytes: photo.bytes });
    assetId = asset.id;
  } catch (e) {
    if (e instanceof UploadError) {
      return { error: e.message, status: 400 };
    }
    throw e;
  }

  const title = titleFromFile(photo.fileName);
  await addToUploads(db, ctx, { asset_id: assetId, label: title });
  const { urls } = await signedAssets(db, ctx.orgId, [assetId], 'pickerTile');
  return { product: { id: `${UPLOAD_ID_PREFIX}${assetId}`, title, image: urls[assetId] ?? null } };
}
