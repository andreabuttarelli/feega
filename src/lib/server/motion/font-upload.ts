import type { Db } from '$lib/server/db/client';
import { deleteAsset, insertAsset, setAssetContent } from '$lib/server/repos/assets';
import { FontStyle, deleteOrgFont, insertOrgFont, listOrgFonts, renameOrgFont, type OrgFont } from '$lib/server/repos/org-fonts';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { FONT_NAME } from '@feega/motion-core/motion/fonts/model';
import { familyFromFileName, fontFamilies, type FontFamily, type FontFile } from '$lib/motion/fonts/library';
import { orgFontPrefix } from '$lib/motion/fonts/upload-path';
import type { OrgFontFace } from '$lib/fonts/org-fonts';
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

export async function saveFontUpload(db: Db, input: { orgId: string; userId: string | null; path: string }): Promise<FontSaved> {
  if (!input.path.startsWith(orgFontPrefix(input.orgId)) || input.path.includes('..')) {
    return { ok: false, error: 'invalid_path' };
  }
  const download = await db.storage.from(CANVAS_ASSET_BUCKET).download(input.path);
  if (download.error || !download.data) {
    return { ok: false, error: 'file_not_found' };
  }
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const refusal = fontRefusal(bytes);
  if (refusal) {
    await db.storage.from(CANVAS_ASSET_BUCKET).remove([input.path]);
    return { ok: false, error: refusal };
  }
  return registerFont(db, { ...input, bytes });
}

function fontRefusal(bytes: Uint8Array): string | null {
  if (bytes.length > MAX_FONT_BYTES) {
    return `a font file is at most ${MAX_FONT_BYTES / MB}MB`;
  }
  return fontFormatOf(bytes) ? null : 'not a font: upload a TTF, OTF, WOFF or WOFF2 file';
}

async function registerFont(db: Db, input: { orgId: string; userId: string | null; path: string; bytes: Uint8Array }): Promise<FontSaved> {
  const format = fontFormatOf(input.bytes)!;
  const meta = readFontMeta(input.bytes) ?? { family: familyFromFileName(input.path), weight: REGULAR, italic: false };
  const asset = await insertAsset(db, { orgId: input.orgId, projectId: null, type: 'document', source: 'upload', url: input.path, content: JSON.stringify(meta), mimeType: `font/${format}`, bytes: input.bytes.length });
  await insertOrgFont(db, { id: asset.id, orgId: input.orgId, family: meta.family, weight: meta.weight, style: meta.italic ? FontStyle.Italic : FontStyle.Normal, path: input.path, uploadedBy: input.userId });
  return { ok: true, assetId: asset.id, format, font: { assetId: asset.id, ...meta } };
}

const fileOf = (font: OrgFont): FontFile => ({ assetId: font.id, family: font.family, weight: font.weight, italic: font.style === FontStyle.Italic });

async function orgFontFiles(db: Db, orgId: string) {
  return (await listOrgFonts(db, orgId)).map((font) => ({ font, file: fileOf(font) }));
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
    await renameOrgFont(db, { orgId: input.orgId, id: file.assetId, family: to });
    await setAssetContent(db, { orgId: input.orgId, assetId: file.assetId, content: JSON.stringify({ family: to, weight: file.weight, italic: file.italic }) });
  }
  return { ok: true };
}

export async function deleteFontFamily(db: Db, input: { orgId: string; family: string }): Promise<FontChange> {
  const own = (await orgFontFiles(db, input.orgId)).filter((f) => f.file.family === input.family);
  if (!own.length) {
    return { ok: false, error: `no uploaded font ${input.family}` };
  }
  for (const { font } of own) {
    await deleteOrgFont(db, { orgId: input.orgId, id: font.id });
    await deleteAsset(db, { orgId: input.orgId, assetId: font.id });
  }
  await db.storage.from(CANVAS_ASSET_BUCKET).remove(own.map((f) => f.font.path));
  return { ok: true };
}

const UNSAFE_FILE_NAME = /[^\w.-]+/g;

export async function storeFontFile(db: Db, input: { orgId: string; userId: string | null; name: string; bytes: Uint8Array }): Promise<FontSaved> {
  const refusal = fontRefusal(input.bytes);
  if (refusal) {
    return { ok: false, error: refusal };
  }
  const path = `${orgFontPrefix(input.orgId)}${crypto.randomUUID()}-${input.name.replace(UNSAFE_FILE_NAME, '_')}`;
  const stored = await db.storage.from(CANVAS_ASSET_BUCKET).upload(path, input.bytes, { contentType: `font/${fontFormatOf(input.bytes)}` });
  if (stored.error) {
    return { ok: false, error: 'store_failed' };
  }
  return registerFont(db, { orgId: input.orgId, userId: input.userId, path, bytes: input.bytes });
}

export async function storeFontBytes(db: Db, input: { orgId: string; userId: string | null; name: string; bytes: Uint8Array }): Promise<FontSaved> {
  const meta = readFontMeta(input.bytes);
  const known = meta ? (await listOrgFonts(db, input.orgId)).find((f) => f.family === meta.family && f.weight === meta.weight && (f.style === FontStyle.Italic) === meta.italic) : undefined;
  const format = fontFormatOf(input.bytes);
  if (known && format) {
    return { ok: true, assetId: known.id, format, font: fileOf(known) };
  }
  return storeFontFile(db, input);
}

export async function orgFontFaces(db: Db, orgId: string, sign: (paths: string[]) => Promise<Map<string, string>>): Promise<OrgFontFace[]> {
  const fonts = await listOrgFonts(db, orgId);
  const urls = await sign(fonts.map((f) => f.path));
  return fonts.map((font) => ({ ...fileOf(font), url: urls.get(font.path) ?? null }));
}
