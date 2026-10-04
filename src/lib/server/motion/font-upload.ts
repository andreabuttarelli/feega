import type { Db } from '$lib/server/db/client';
import { insertAsset } from '$lib/server/repos/assets';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';

export enum FontFormat {
  Woff2 = 'woff2',
  Woff = 'woff',
  Ttf = 'ttf',
  Otf = 'otf'
}

const MB = 1024 * 1024;
export const MAX_FONT_BYTES = 10 * MB;

const SIGNATURES: [FontFormat, number[]][] = [
  [FontFormat.Woff2, [0x77, 0x4f, 0x46, 0x32]],
  [FontFormat.Woff, [0x77, 0x4f, 0x46, 0x46]],
  [FontFormat.Otf, [0x4f, 0x54, 0x54, 0x4f]],
  [FontFormat.Ttf, [0x00, 0x01, 0x00, 0x00]],
  [FontFormat.Ttf, [0x74, 0x72, 0x75, 0x65]]
];

export function fontFormatOf(bytes: Uint8Array): FontFormat | null {
  return SIGNATURES.find(([, magic]) => magic.every((b, i) => bytes[i] === b))?.[0] ?? null;
}

export type FontSaved = { ok: true; assetId: string; format: FontFormat } | { ok: false; error: string };

export async function saveFontUpload(db: Db, input: { orgId: string; projectId: string; path: string }): Promise<FontSaved> {
  if (!input.path.startsWith(canvasUploadPrefix(input.orgId, input.projectId)) || input.path.includes('..')) {
    return { ok: false, error: 'invalid_path' };
  }
  const download = await db.storage.from(CANVAS_ASSET_BUCKET).download(input.path);
  if (download.error || !download.data) {
    return { ok: false, error: 'file_not_found' };
  }
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  if (bytes.length > MAX_FONT_BYTES) {
    await db.storage.from(CANVAS_ASSET_BUCKET).remove([input.path]);
    return { ok: false, error: `a font file is at most ${MAX_FONT_BYTES / MB}MB` };
  }
  const format = fontFormatOf(bytes);
  if (!format) {
    await db.storage.from(CANVAS_ASSET_BUCKET).remove([input.path]);
    return { ok: false, error: 'not a font: upload a TTF, OTF, WOFF or WOFF2 file' };
  }
  const asset = await insertAsset(db, { orgId: input.orgId, projectId: input.projectId, type: 'document', source: 'upload', url: input.path, mimeType: `font/${format}`, bytes: bytes.length });
  return { ok: true, assetId: asset.id, format };
}
