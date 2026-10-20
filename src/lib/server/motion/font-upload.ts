import type { Db } from '$lib/server/db/client';
import { deleteAsset, insertAsset, listFontAssets, setAssetContent } from '$lib/server/repos/assets';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { FONT_NAME } from '$lib/motion/fonts/model';
import { familyFromFileName, fontFamilies, fontFileOf, type FontFamily, type FontFile } from '$lib/motion/fonts/library';
import { orgFontPrefix } from '$lib/motion/fonts/upload-path';
import { readFontMeta } from './font-meta';

export { orgFontPrefix };

export enum FontFormat {
  Woff2 = 'woff2',
  Woff = 'woff',
  Ttf = 'ttf',
  Otf = 'otf'
}

const MB = 1024 * 1024;
export const MAX_FONT_BYTES = 10 * MB;
const LIBRARY_LIMIT = 200;
const REGULAR = 400;

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

export type FontSaved = { ok: true; assetId: string; format: FontFormat; font: FontFile } | { ok: false; error: string };

export type FontChange = { ok: true } | { ok: false; error: string };

export async function saveFontUpload(db: Db, input: { orgId: string; path: string }): Promise<FontSaved> {
  if (!input.path.startsWith(orgFontPrefix(input.orgId)) || input.path.includes('..')) {
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
  const meta = readFontMeta(bytes) ?? { family: familyFromFileName(input.path), weight: REGULAR, italic: false };
  const asset = await insertAsset(db, { orgId: input.orgId, projectId: null, type: 'document', source: 'upload', url: input.path, content: JSON.stringify(meta), mimeType: `font/${format}`, bytes: bytes.length });
  return { ok: true, assetId: asset.id, format, font: { assetId: asset.id, ...meta } };
}

async function orgFontFiles(db: Db, orgId: string) {
  const assets = await listFontAssets(db, { orgId, limit: LIBRARY_LIMIT });
  return assets.map((asset) => ({ asset, file: fontFileOf(asset) }));
}

export async function orgFontFamilies(db: Db, orgId: string): Promise<FontFamily[]> {
  return fontFamilies((await orgFontFiles(db, orgId)).map((f) => f.file));
}

export async function renameFontFamily(db: Db, input: { orgId: string; family: string; to: string }): Promise<FontChange> {
  const to = input.to.trim();
  if (!FONT_NAME.test(to)) {
    return { ok: false, error: 'a font name is letters, digits, spaces, dots, dashes or apostrophes, up to 64' };
  }
  const files = await orgFontFiles(db, input.orgId);
  const own = files.filter((f) => f.file.family === input.family);
  if (!own.length) {
    return { ok: false, error: `no uploaded font ${input.family}` };
  }
  if (to !== input.family && files.some((f) => f.file.family === to)) {
    return { ok: false, error: `an uploaded font is already named ${to}` };
  }
  for (const { file } of own) {
    await setAssetContent(db, { orgId: input.orgId, assetId: file.assetId, content: JSON.stringify({ family: to, weight: file.weight, italic: file.italic }) });
  }
  return { ok: true };
}

export async function deleteFontFamily(db: Db, input: { orgId: string; family: string }): Promise<FontChange> {
  const own = (await orgFontFiles(db, input.orgId)).filter((f) => f.file.family === input.family);
  if (!own.length) {
    return { ok: false, error: `no uploaded font ${input.family}` };
  }
  for (const { asset } of own) {
    await deleteAsset(db, { orgId: input.orgId, assetId: asset.id });
  }
  await db.storage.from(CANVAS_ASSET_BUCKET).remove(own.map((f) => f.asset.url ?? '').filter(Boolean));
  return { ok: true };
}
