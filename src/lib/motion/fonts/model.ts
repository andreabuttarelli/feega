import { z } from 'zod';

export enum BuiltinFont {
  Sans = 'sans',
  Mono = 'mono'
}

export enum FontSource {
  Google = 'google',
  Upload = 'upload'
}

export enum FontCategory {
  Sans = 'sans',
  Serif = 'serif',
  Display = 'display',
  Handwriting = 'handwriting',
  Mono = 'mono'
}

export const FONT_NAME = /^[A-Za-z0-9][A-Za-z0-9 \-.']{0,63}$/;
export const MAX_FONTS = 24;
export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

const BUILTIN: Record<BuiltinFont, string> = {
  [BuiltinFont.Sans]: "'DM Sans', system-ui, sans-serif",
  [BuiltinFont.Mono]: "'Fragment Mono', ui-monospace, monospace"
};

const FALLBACK: Record<FontCategory, string> = {
  [FontCategory.Sans]: 'system-ui, sans-serif',
  [FontCategory.Serif]: 'Georgia, serif',
  [FontCategory.Display]: 'system-ui, sans-serif',
  [FontCategory.Handwriting]: 'cursive',
  [FontCategory.Mono]: 'ui-monospace, monospace'
};

export const fontFaceSchema = z.object({
  family: z.string().regex(FONT_NAME),
  source: z.enum([FontSource.Google, FontSource.Upload]),
  category: z.enum(Object.values(FontCategory) as [FontCategory, ...FontCategory[]]).default(FontCategory.Sans),
  weights: z.array(z.number().int().min(100).max(900)).min(1).max(FONT_WEIGHTS.length),
  italic: z.boolean().default(false),
  assetId: z.string().min(1).optional()
});

export const fontsSchema = z.array(fontFaceSchema).max(MAX_FONTS).default([]);

export type FontFace = z.infer<typeof fontFaceSchema>;

export type CatalogueFont = { f: string; c: string; w: number[]; i: number };

export type Face = { family: string; weight: number; italic: boolean };

export function isBuiltin(family: string): family is BuiltinFont {
  return family in BUILTIN;
}

export function fontStack(family: string, registry: readonly FontFace[]): string {
  if (isBuiltin(family)) {
    return BUILTIN[family];
  }
  const face = registry.find((f) => f.family === family);
  return `'${family}', ${FALLBACK[face?.category ?? FontCategory.Sans]}`;
}

export function fontRefProblem(family: unknown, registry: readonly FontFace[]): string | null {
  if (typeof family !== 'string' || isBuiltin(family) || registry.some((f) => f.family === family)) {
    return null;
  }
  return `font ${family} is not in this video: call set_font with the family (it registers it), or pick a built-in (${Object.values(BuiltinFont).join(', ')})`;
}

export function nearestWeight(weight: number, available: readonly number[]): number {
  return [...available].sort((a, b) => Math.abs(a - weight) - Math.abs(b - weight) || b - a)[0];
}

export function loadedWeight(family: string, weight: number, registry: readonly FontFace[]): number {
  const face = registry.find((f) => f.family === family);
  return face ? nearestWeight(weight, face.weights) : weight;
}

const GOOGLE_CSS = 'https://fonts.googleapis.com/css2';

const faceKey = (f: Face) => `${f.family}|${f.weight}|${f.italic}`;

export function uniqueFaces(faces: readonly Face[]): Face[] {
  return [...new Map(faces.map((f) => [faceKey(f), f])).values()];
}

export function googleFontsUrl(faces: readonly Face[], registry: readonly FontFace[]): string | null {
  const families = new Map<string, Set<string>>();
  for (const face of faces) {
    const entry = registry.find((f) => f.family === face.family && f.source === FontSource.Google);
    if (!entry) {
      continue;
    }
    const italic = face.italic && entry.italic ? 1 : 0;
    const tuples = families.get(entry.family) ?? new Set<string>();
    tuples.add(`${italic},${nearestWeight(face.weight, entry.weights)}`);
    families.set(entry.family, tuples);
  }
  if (!families.size) {
    return null;
  }
  const order = (t: string) => t.split(',').map(Number);
  const query = [...families]
    .map(([family, tuples]) => {
      const sorted = [...tuples].sort((a, b) => order(a)[0] - order(b)[0] || order(a)[1] - order(b)[1]);
      return `family=${family.replace(/ /g, '+')}:ital,wght@${sorted.join(';')}`;
    })
    .join('&');
  return `${GOOGLE_CSS}?${query}&display=block`;
}

const DECLARED = "src:local('feega-declared');font-weight:1;unicode-range:U+0";

export function declaredFamilyCss(faces: readonly Face[], registry: readonly FontFace[]): string {
  const google = new Set(faces.filter((f) => registry.some((r) => r.family === f.family && r.source === FontSource.Google)).map((f) => f.family));
  return [...google].map((family) => `@font-face{font-family:'${family}';${DECLARED}}`).join('');
}

export function uploadFaceCss(registry: readonly FontFace[], assets: Record<string, string>): string {
  return registry
    .filter((f) => f.source === FontSource.Upload && f.assetId && assets[f.assetId])
    .flatMap((f) => f.weights.map((w) => `@font-face{font-family:'${f.family}';src:url(${JSON.stringify(assets[f.assetId!])});font-weight:${w};font-style:normal;font-display:block}`))
    .join('');
}

export function faceDescriptor(face: Face): string {
  return `${face.italic ? 'italic' : 'normal'} ${face.weight} 1em "${face.family}"`;
}

type TextClip = { component: string; props: Record<string, unknown> };
type FontDoc = { tracks: { clips: TextClip[] }[]; components: Record<string, { propsSchema: { properties: Record<string, { format?: string }> } }> };

const FONT_FORMAT = 'font';
const DEFAULT_WEIGHT = 400;

function clipFaces(clip: TextClip, doc: FontDoc): Face[] {
  if (clip.component === 'Custom') {
    const spec = doc.components[String(clip.props.name)]?.propsSchema.properties ?? {};
    return Object.entries(spec)
      .filter(([key, s]) => s.format === FONT_FORMAT && typeof clip.props[key] === 'string')
      .map(([key]) => ({ family: String(clip.props[key]), weight: DEFAULT_WEIGHT, italic: false }));
  }
  if (typeof clip.props.font !== 'string') {
    return [];
  }
  return [{ family: clip.props.font, weight: Number(clip.props.weight ?? DEFAULT_WEIGHT), italic: clip.props.italic === true }];
}

export function usedFaces(doc: FontDoc): Face[] {
  return uniqueFaces(doc.tracks.flatMap((t) => t.clips.flatMap((c) => clipFaces(c, doc))).filter((f) => !isBuiltin(f.family)));
}

export function searchFonts(catalogue: readonly CatalogueFont[], query: string, brand: readonly string[], limit: number): CatalogueFont[] {
  const q = query.trim().toLowerCase();
  const brandFirst = [...brand.map((name) => catalogue.find((f) => f.f === name)).filter((f): f is CatalogueFont => Boolean(f)), ...catalogue.filter((f) => !brand.includes(f.f))];
  if (!q) {
    return brandFirst.slice(0, limit);
  }
  const starts = brandFirst.filter((f) => f.f.toLowerCase().startsWith(q));
  const contains = brandFirst.filter((f) => !f.f.toLowerCase().startsWith(q) && f.f.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}

const MIN_NAME = 4;

export function fontsFrom(content: string | null, catalogue: readonly CatalogueFont[]): string[] {
  const text = content ?? '';
  const found = catalogue
    .filter((f) => f.f.length >= MIN_NAME)
    .map((f) => ({ family: f.f, at: new RegExp(`\\b${f.f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).exec(text)?.index ?? -1 }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);
  return found.map((m) => m.family).filter((family, _, all) => !all.some((other) => other !== family && other.includes(family)));
}
