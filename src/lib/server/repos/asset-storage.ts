import type { Db } from '$lib/server/db/client';
import { signThumbnailUrls, type ThumbnailPreset } from '$lib/server/media-thumbnails';

export const CANVAS_ASSET_BUCKET = 'canvas-assets';
const SIGNED_URL_SECONDS = 300;

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
  ttlSeconds = SIGNED_URL_SECONDS,
  preset?: ThumbnailPreset
): Promise<Map<string, string>> {
  return signThumbnailUrls(() => db.storage.from(CANVAS_ASSET_BUCKET), paths, ttlSeconds, preset);
}

export const PREVIEW_EDGE_PX = 1024;
const PREVIEW_QUALITY = 80;

export async function signStoredFile(db: Db, bucket: string, path: string): Promise<string | null> {
  const { data } = await db.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

export async function signStoredPreview(db: Db, bucket: string, path: string): Promise<string | null> {
  const { data } = await db.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS, {
    transform: { width: PREVIEW_EDGE_PX, height: PREVIEW_EDGE_PX, resize: 'contain', quality: PREVIEW_QUALITY }
  });
  return data?.signedUrl ?? null;
}
