import sharp, { type FormatEnum } from 'sharp';
import type { Db } from '$lib/server/db/client';
import { safeFetchBytes } from '$lib/server/tool-guard';
import { probeImageDimensions } from '$lib/server/brand-media';
import { insertAsset } from '$lib/server/repos/assets';
import { signAssetFile, storeAssetFile } from '$lib/server/repos/asset-storage';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
import { AssetKind } from '$lib/motion/components';
import type { AssetImport } from './motion-tools';

export const IMPORT_MAX_BYTES = 12_000_000;
export const IMPORT_MAX_EDGE = 2048;
export const CAPTURE_MAX_EDGE = 3840;
const IMPORT_TIMEOUT_MS = 20_000;
const SNIFF_BYTES = 512;

type Picture = { mime: string; ext: string; scalable: keyof FormatEnum | null };

const SIGNATURES: [Picture, (head: Buffer) => boolean][] = [
  [{ mime: 'image/png', ext: 'png', scalable: 'png' }, (h) => h.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))],
  [{ mime: 'image/jpeg', ext: 'jpg', scalable: 'jpeg' }, (h) => h.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))],
  [{ mime: 'image/gif', ext: 'gif', scalable: null }, (h) => h.subarray(0, 4).toString('latin1') === 'GIF8'],
  [{ mime: 'image/webp', ext: 'webp', scalable: 'webp' }, (h) => h.subarray(0, 4).toString('latin1') === 'RIFF' && h.subarray(8, 12).toString('latin1') === 'WEBP'],
  [{ mime: 'image/avif', ext: 'avif', scalable: 'avif' }, (h) => h.subarray(4, 12).toString('latin1') === 'ftypavif'],
  [{ mime: 'image/svg+xml', ext: 'svg', scalable: null }, (h) => /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(h.toString('utf8'))]
];

function fitted(bytes: Buffer, picture: Picture, edge: number): Promise<Buffer> {
  if (!picture.scalable) {
    return Promise.resolve(bytes);
  }
  return sharp(bytes).resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).toFormat(picture.scalable).toBuffer();
}

export function pictureOf(bytes: Buffer): Picture | null {
  const head = bytes.subarray(0, SNIFF_BYTES);
  return SIGNATURES.find(([, matches]) => matches(head))?.[0] ?? null;
}

type ImportScope = { orgId: string; projectId: string; canvasId: string };

export async function importImageAsset(db: Db, scope: ImportScope, url: string, label?: string): Promise<AssetImport> {
  const fetched = await safeFetchBytes(url, { maxBytes: IMPORT_MAX_BYTES, timeoutMs: IMPORT_TIMEOUT_MS, scheme: 'https-only' }).catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
  if (typeof fetched === 'string') {
    return { ok: false, error: `could not download ${url}: ${fetched}` };
  }
  if (!fetched.ok) {
    return { ok: false, error: `the server answered ${fetched.status}` };
  }
  return storeImage(db, scope, { bytes: fetched.bytes, url: fetched.url }, label);
}

export async function storeImage(db: Db, scope: ImportScope, file: { bytes: Buffer; url: string }, label?: string, edge = IMPORT_MAX_EDGE): Promise<AssetImport> {
  const picture = pictureOf(file.bytes);
  if (!picture) {
    return { ok: false, error: `not an image (PNG, JPEG, WebP, GIF, AVIF or SVG): ${file.url}` };
  }
  if (file.bytes.length > IMPORT_MAX_BYTES) {
    return { ok: false, error: `larger than ${IMPORT_MAX_BYTES / 1_000_000} MB` };
  }

  const bytes = await fitted(file.bytes, picture, edge);
  const path = `${canvasUploadPrefix(scope.orgId, scope.projectId)}imports/${crypto.randomUUID()}.${picture.ext}`;
  await storeAssetFile(db, path, new File([new Uint8Array(bytes)], path.split('/').at(-1) as string, { type: picture.mime }));
  const { width, height } = await probeImageDimensions(bytes);
  const row = await insertAsset(db, { orgId: scope.orgId, projectId: scope.projectId, type: 'image', source: 'imported', url: path, mimeType: picture.mime, bytes: bytes.length, width, height });

  return {
    ok: true,
    width,
    height,
    asset: { id: row.id, kind: AssetKind.Image, width, height, label: label ?? `image · ${new URL(file.url).hostname}`, previewUrl: `/p/${scope.projectId}/c/${scope.canvasId}/assets/${row.id}`, url: await signAssetFile(db, path) }
  };
}
