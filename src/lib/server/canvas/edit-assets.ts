import sharp from 'sharp';
import type { Db } from '$lib/server/db/client';
import { findAsset, insertAsset, type Asset } from '$lib/server/repos/assets';
import { signMediaPaths } from './sign-media';
import type { PixelSize } from '$lib/server/image-mask';

const GENERATED_MEDIA_BUCKET = 'brand-knowledge';
const PNG = 'image/png';

type PngScope = { orgId: string; projectId: string; userId: string; nodeId: string; png: Buffer; width: number; height: number };

export async function storePng(db: Db, scope: PngScope): Promise<Asset> {
  const path = `${scope.userId}/media/edits/${crypto.randomUUID()}.png`;
  const { error } = await db.storage.from(GENERATED_MEDIA_BUCKET).upload(path, new Blob([new Uint8Array(scope.png)], { type: PNG }), { contentType: PNG, upsert: false });
  if (error) {
    throw new Error(`store_failed: ${error.message}`);
  }
  return insertAsset(db, {
    orgId: scope.orgId,
    projectId: scope.projectId,
    type: 'image',
    source: 'generated',
    url: path,
    mimeType: PNG,
    bytes: scope.png.byteLength,
    width: scope.width,
    height: scope.height,
    sourceNodeId: scope.nodeId
  });
}

async function measured(db: Db, asset: Asset): Promise<PixelSize | null> {
  const [url] = await signMediaPaths(db, [asset.url ?? '']);
  if (!url) {
    return null;
  }
  const meta = await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).metadata();
  return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
}

export async function pixelSizeOf(db: Db, scope: { orgId: string; assetId: string }): Promise<PixelSize | null> {
  const asset = await findAsset(db, scope);
  if (!asset || asset.type !== 'image') {
    return null;
  }
  return asset.width && asset.height ? { width: asset.width, height: asset.height } : measured(db, asset);
}
