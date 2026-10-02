import type { Db } from '$lib/server/db/client';
import type { AssetSource } from '$lib/server/repos/assets';
import { signThumbnailUrls, type ThumbnailPreset } from '$lib/server/media-thumbnails';

export const CANVAS_ASSET_BUCKET = 'canvas-assets';

export const BUCKET_BY_SOURCE: Record<AssetSource, string> = {
  generated: 'brand-knowledge',
  upload: CANVAS_ASSET_BUCKET,
  imported: CANVAS_ASSET_BUCKET
};
export const SIGNED_URL_TTL_S = {
  canvas: 86_400,
  agentPreview: 300,
  providerInput: 300,
  userLink: 3600
} as const;

const SIGNED_URL_SECONDS = SIGNED_URL_TTL_S.canvas;
const REDIRECT_SHARE_OF_TTL = 4;
export const CANVAS_REDIRECT_MAX_AGE_S = SIGNED_URL_SECONDS / REDIRECT_SHARE_OF_TTL;

export async function storeAssetFile(db: Db, path: string, file: File): Promise<void> {
  const { error } = await db.storage.from(CANVAS_ASSET_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) {
    throw error;
  }
}

export async function removeAssetFile(db: Db, path: string): Promise<void> {
  const { error } = await db.storage.from(CANVAS_ASSET_BUCKET).remove([path]);
  if (error) {
    throw error;
  }
}

export async function signAssetFile(db: Db, path: string): Promise<string> {
  const { data, error } = await db.storage.from(CANVAS_ASSET_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) {
    throw error;
  }
  return data.signedUrl;
}

export async function signAssetFiles(
  db: Db,
  paths: string[],
  ttlSeconds: number = SIGNED_URL_SECONDS,
  preset?: ThumbnailPreset
): Promise<Map<string, string>> {
  return signThumbnailUrls({ name: CANVAS_ASSET_BUCKET, open: () => db.storage.from(CANVAS_ASSET_BUCKET) }, paths, ttlSeconds, preset);
}

export const PREVIEW_EDGE_PX = 1024;
const PREVIEW_QUALITY = 80;

export async function signStoredFile(db: Db, bucket: string, path: string, ttlSeconds: number): Promise<string | null> {
  const { data } = await db.storage.from(bucket).createSignedUrl(path, ttlSeconds);
  return data?.signedUrl ?? null;
}

export async function signStoredPreview(db: Db, bucket: string, path: string, ttlSeconds: number): Promise<string | null> {
  const { data } = await db.storage.from(bucket).createSignedUrl(path, ttlSeconds, {
    transform: { width: PREVIEW_EDGE_PX, height: PREVIEW_EDGE_PX, resize: 'contain', quality: PREVIEW_QUALITY }
  });
  return data?.signedUrl ?? null;
}
