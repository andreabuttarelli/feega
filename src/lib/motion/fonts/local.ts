import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { keepLocalFiles, type LocalFile } from '@feega/motion-core/motion/fonts/local-files';
import { FONT_WEIGHTS, FontCategory, FontSource, isBuiltin, type FontFace } from '@feega/motion-core/motion/fonts/model';
import { withUploaded } from './ops';

export enum LocalFonts {
  Unsupported = 'unsupported',
  Denied = 'denied',
  Ready = 'ready'
}

export enum FontOrigin {
  Catalogue = 'catalogue',
  Local = 'local'
}

export type LocalFontsRead = { state: LocalFonts.Unsupported } | { state: LocalFonts.Denied } | { state: LocalFonts.Ready; families: string[]; load: (family: string) => Promise<void> };

type InstalledFont = { family: string; style: string; blob: () => Promise<Blob> };

type FontAccess = { queryLocalFonts?: () => Promise<InstalledFont[]> };

const STYLE_WEIGHTS: [RegExp, number][] = [
  [/thin|hairline/i, 100],
  [/extra ?light|ultra ?light/i, 200],
  [/light/i, 300],
  [/semi ?bold|demi ?bold/i, 600],
  [/extra ?bold|ultra ?bold|heavy/i, 800],
  [/black/i, 900],
  [/bold/i, 700],
  [/medium/i, 500]
];
const REGULAR_WEIGHT = 400;
const ITALIC_STYLE = /italic|oblique/i;

const weightOf = (style: string) => STYLE_WEIGHTS.find(([pattern]) => pattern.test(style))?.[1] ?? REGULAR_WEIGHT;

async function fileOf(font: InstalledFont): Promise<LocalFile> {
  return { url: URL.createObjectURL(await font.blob()), weight: weightOf(font.style), italic: ITALIC_STYLE.test(font.style) };
}

export async function readLocalFonts(host: object): Promise<LocalFontsRead> {
  const { queryLocalFonts } = host as FontAccess;
  if (!queryLocalFonts) {
    return { state: LocalFonts.Unsupported };
  }
  try {
    const found = await queryLocalFonts.call(host);
    const load = async (family: string) => keepLocalFiles(family, await Promise.all(found.filter((f) => f.family === family).map(fileOf)));
    return { state: LocalFonts.Ready, families: [...new Set(found.map((f) => f.family))].sort((a, b) => a.localeCompare(b)), load };
  } catch {
    return { state: LocalFonts.Denied };
  }
}

export const localFamilies = (registry: readonly FontFace[]): string[] => registry.filter((f) => f.source === FontSource.Local).map((f) => f.family);

export function localFontNote(registry: readonly FontFace[]): string | null {
  const families = localFamilies(registry);
  if (!families.length) {
    return null;
  }
  return `${families.join(', ')} ${families.length > 1 ? 'are' : 'is'} installed on this computer only: other computers and server renders show a fallback font.`;
}

export function registerLocal(doc: MotionDoc, family: string): OpResult {
  if (isBuiltin(family)) {
    return { ok: false, error: `${family} is a built-in font, not an installed one` };
  }
  const known = doc.fonts.find((f) => f.family === family);
  if (known) {
    return known.source === FontSource.Local ? { ok: true, doc } : { ok: false, error: `a font named ${family} is already in this video` };
  }
  const face: FontFace = { family, source: FontSource.Local, category: FontCategory.Sans, weights: [...FONT_WEIGHTS], italic: true, axes: [] };
  return { ok: true, doc: { ...doc, fonts: [...doc.fonts, face] } };
}

type Picked = { doc: MotionDoc; family: string };

const PICKS: Record<FontOrigin, (doc: MotionDoc, family: string, uploaded: Parameters<typeof withUploaded>[2]) => Picked> = {
  [FontOrigin.Catalogue]: withUploaded,
  [FontOrigin.Local]: (doc, family) => {
    const out = registerLocal(doc, family);
    return { doc: out.ok ? out.doc : doc, family };
  }
};

export const withPicked = (doc: MotionDoc, family: string, origin: FontOrigin, uploaded: Parameters<typeof withUploaded>[2]): Picked => PICKS[origin](doc, family, uploaded);
