import { z } from 'zod';
import { FONT_NAME, FontSource, variantsOf, type FontFace, type FontVariant } from './model';

const MIN_WEIGHT = 1;
const MAX_WEIGHT = 1000;
const REGULAR = 400;

export const fontMetaSchema = z.object({ family: z.string().regex(FONT_NAME), weight: z.number().int().min(MIN_WEIGHT).max(MAX_WEIGHT), italic: z.boolean() });

export type FontMeta = z.infer<typeof fontMetaSchema>;

export type { FontVariant };

export type FontFile = FontVariant & { family: string };

export type FontFamily = { family: string; variants: FontVariant[] };

const UNSAFE = /[^A-Za-z0-9 \-.']+/g;
const EXTENSION = /\.(ttf|otf|woff2?)$/i;
const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;
const MAX_FAMILY = 60;
const UNNAMED = 'Uploaded font';

export function familyFromFileName(fileName: string): string {
  const base = fileName.split('/').pop()!.replace(UUID_PREFIX, '').replace(EXTENSION, '').replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim();
  return base.slice(0, MAX_FAMILY).trim() || UNNAMED;
}

export function fontFileOf(asset: { id: string; url: string | null; content: string | null }): FontFile {
  const parsed = fontMetaSchema.safeParse(safeJson(asset.content));
  const meta = parsed.success ? parsed.data : { family: familyFromFileName(asset.url ?? ''), weight: REGULAR, italic: false };
  return { assetId: asset.id, ...meta };
}

function safeJson(text: string | null): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

const byFace = (a: FontVariant, b: FontVariant) => a.weight - b.weight || Number(a.italic) - Number(b.italic);

export function fontFamilies(files: readonly FontFile[]): FontFamily[] {
  const families = new Map<string, FontVariant[]>();
  for (const { family, ...variant } of files) {
    families.set(family, [...(families.get(family) ?? []), variant]);
  }
  return [...families].map(([family, variants]) => ({ family, variants: variants.sort(byFace) })).sort((a, b) => a.family.localeCompare(b.family));
}

export function missingUploads(registry: readonly FontFace[], urls: Record<string, string>): string[] {
  return registry.filter((f) => f.source === FontSource.Upload && !variantsOf(f).some((v) => urls[v.assetId])).map((f) => f.family);
}

export type FontUploaded = { ok: true; family: string } | { ok: false; error: string };

export const FONT_FILE = /\.(ttf|otf|woff2?)$/i;

export const MAX_FONT_MB = 10;

export type FontLibrary = {
  families: FontFamily[];
  missing: string[];
  upload: (file: File) => Promise<FontUploaded>;
  rename: (family: string, to: string) => Promise<string | null>;
  remove: (family: string) => Promise<string | null>;
};

export const FONT_MIME_TYPES = ['font/woff2', 'font/woff', 'font/ttf', 'font/otf'];
