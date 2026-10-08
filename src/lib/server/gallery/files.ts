import type { Db } from '$lib/server/db/client';
import { storeAssetFile } from '$lib/server/repos/asset-storage';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';

export const GALLERY_BUCKET = 'media';
export const GALLERY_PREFIX = 'gallery';
export const REMIX_FOLDER = 'remix/';

export const GALLERY_MAX_BYTES = 50_000_000;
const FETCH_TIMEOUT_MS = 60_000;

export type FileBytes = { bytes: Buffer; mime: string };

const EXTENSION: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'model/gltf-binary': 'glb',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/ttf': 'ttf',
  'font/otf': 'otf'
};

const FALLBACK_EXTENSION = 'bin';

export const extensionOf = (mime: string) => EXTENSION[mime.split(';')[0].trim().toLowerCase()] ?? FALLBACK_EXTENSION;

export async function downloadFile(url: string): Promise<FileBytes> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`could not read ${new URL(url).pathname}: ${res.status}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > GALLERY_MAX_BYTES) {
    throw new Error(`file larger than ${GALLERY_MAX_BYTES / 1_000_000} MB`);
  }
  return { bytes, mime: res.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream' };
}

export const galleryFolder = (itemId: string) => `${GALLERY_PREFIX}/${itemId}/`;

export function galleryUrl(db: Db, path: string): string {
  return db.storage.from(GALLERY_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function isGalleryFile(db: Db, url: string, itemId: string): boolean {
  return url.startsWith(galleryUrl(db, galleryFolder(itemId)));
}

export async function publishFile(db: Db, itemId: string, name: string, file: FileBytes): Promise<string> {
  const path = `${galleryFolder(itemId)}${name}.${extensionOf(file.mime)}`;
  const { error } = await db.storage.from(GALLERY_BUCKET).upload(path, file.bytes, { contentType: file.mime, upsert: false });
  if (error) {
    throw error;
  }
  return galleryUrl(db, path);
}

export async function removeGalleryFiles(db: Db, itemId: string): Promise<void> {
  const folder = galleryFolder(itemId);
  const { data, error } = await db.storage.from(GALLERY_BUCKET).list(folder.slice(0, -1));
  if (error) {
    throw error;
  }
  const paths = (data ?? []).map((f) => `${folder}${f.name}`);
  if (!paths.length) {
    return;
  }
  const removed = await db.storage.from(GALLERY_BUCKET).remove(paths);
  if (removed.error) {
    throw removed.error;
  }
}

export async function storeRemixFile(db: Db, scope: { orgId: string; projectId: string }, file: FileBytes): Promise<string> {
  const path = `${canvasUploadPrefix(scope.orgId, scope.projectId)}${REMIX_FOLDER}${crypto.randomUUID()}.${extensionOf(file.mime)}`;
  await storeAssetFile(db, path, new File([new Uint8Array(file.bytes)], path.split('/').at(-1) as string, { type: file.mime }));
  return path;
}
