import { z } from 'zod';
import { GALLERY_PATH } from './paths';
import { everyClip, formatOf, FORMATS, MOTION_FORMATS, MotionFormat as MotionFormatEnum, type AssetRef, type MotionDoc, type MotionFormat } from '$lib/motion/doc';

export { GALLERY_PATH, itemPath } from './paths';

export enum GalleryStatus {
  Published = 'published',
  Unlisted = 'unlisted',
  Removed = 'removed'
}

export enum GalleryKind {
  Motion = 'motion',
  Composition = 'composition'
}

export enum Playback {
  OnHover = 'on-hover',
  Always = 'always'
}

export enum DurationBand {
  Short = 'short',
  Medium = 'medium',
  Long = 'long'
}

export const DURATION_BANDS: Record<DurationBand, { label: string; min: number; max: number }> = {
  [DurationBand.Short]: { label: 'Up to 6 s', min: 0, max: 6 },
  [DurationBand.Medium]: { label: '6 to 15 s', min: 6, max: 15 },
  [DurationBand.Long]: { label: 'Over 15 s', min: 15, max: Number.POSITIVE_INFINITY }
};

export const KIND_LABEL: Record<GalleryKind, string> = {
  [GalleryKind.Motion]: 'Motion',
  [GalleryKind.Composition]: 'Composition'
};

export const FEEGA_AUTHOR = 'Feega';
export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 500;
export const TAGS_MAX = 8;
export const TAG_MAX = 24;
export const PAGE_SIZE = 48;
export const SECONDS_CEILING = 180;
export const BRAND_PARAM = 'brand';
export const BRAND_REMIX_PROMPT = 'Put my brand on this video: logo, colours, fonts and copy. Keep its motion and pacing.';

export type GalleryAsset = { id: string; kind: AssetRef['kind']; name: string; url: string };

export type GalleryOrigin = { id: string; title: string; authorName: string };

export type GalleryCard = {
  id: string;
  title: string;
  authorName: string;
  kind: GalleryKind;
  format: MotionFormat;
  durationS: number;
  tags: string[];
  posterUrl: string | null;
  previewUrl: string | null;
  remixCount: number;
  remixedFrom: GalleryOrigin | null;
};

export type GalleryItem = GalleryCard & {
  description: string;
  status: GalleryStatus;
  doc: MotionDoc;
  assets: GalleryAsset[];
  publishedAt: string | null;
};

const tag = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(TAG_MAX)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} -]*$/u, 'tags are words, e.g. launch');

export const publishMetaSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).default(''),
  tags: z
    .array(tag)
    .max(TAGS_MAX)
    .default([])
    .transform((tags) => [...new Set(tags)])
});

export type PublishMeta = z.infer<typeof publishMetaSchema>;

export const gallerySearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  kind: z.enum(GalleryKind).optional(),
  format: z.enum(MOTION_FORMATS).optional(),
  duration: z.enum(DurationBand).optional(),
  tag: z.string().trim().toLowerCase().max(TAG_MAX).optional(),
  min: z.coerce.number().min(0).max(SECONDS_CEILING).optional(),
  max: z.coerce.number().min(0).max(SECONDS_CEILING).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE).default(PAGE_SIZE)
}).transform((s) => (s.min !== undefined && s.max !== undefined && s.min > s.max ? { ...s, min: s.max, max: s.min } : s));

export type GallerySearch = z.infer<typeof gallerySearchSchema>;

export function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function kindOf(doc: MotionDoc): GalleryKind {
  return everyClip(doc).some((c) => c.component === 'Composition') ? GalleryKind.Composition : GalleryKind.Motion;
}

export function secondsOf(doc: Pick<MotionDoc, 'durationInFrames' | 'fps'>): number {
  return Math.round((doc.durationInFrames / doc.fps) * 10) / 10;
}

export function factsOf(doc: MotionDoc): { kind: GalleryKind; format: MotionFormat; durationS: number } {
  return { kind: kindOf(doc), format: formatOf(doc), durationS: secondsOf(doc) };
}

export function bandOf(seconds: number): DurationBand {
  return (Object.keys(DURATION_BANDS) as DurationBand[]).find((band) => seconds <= DURATION_BANDS[band].max) ?? DurationBand.Long;
}

export function byline(card: Pick<GalleryCard, 'authorName' | 'remixedFrom'>): string {
  const by = `by ${card.authorName}`;
  return card.remixedFrom ? `${by} · remix of ${card.remixedFrom.title}` : by;
}

export function assetUrlMap(assets: readonly GalleryAsset[]): Record<string, string> {
  return Object.fromEntries(assets.map((a) => [a.id, a.url]));
}

export function swapAssetIds(doc: MotionDoc, ids: Readonly<Record<string, string>>): MotionDoc {
  const json = Object.entries(ids).reduce((text, [from, to]) => text.split(JSON.stringify(from)).join(JSON.stringify(to)), JSON.stringify(doc));
  return JSON.parse(json) as MotionDoc;
}

type FilterKey = 'format' | 'kind' | 'min' | 'max' | 'tag' | 'q';

export type SearchParams = Partial<Record<FilterKey, string | undefined>>;

export type FilterGroup = { key: 'format' | 'kind'; label: string; options: { value: string; label: string }[] };

const LISTED_FORMATS = MOTION_FORMATS.filter((f) => f !== MotionFormatEnum.SquareLarge);

export const FILTER_GROUPS: readonly FilterGroup[] = [
  { key: 'kind', label: 'Type', options: (Object.keys(KIND_LABEL) as GalleryKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] })) },
  { key: 'format', label: 'Format', options: LISTED_FORMATS.map((f) => ({ value: f, label: FORMATS[f].label })) }
];

export const SLIDER_MAX = 30;
export const RANGE_KEYS = ['min', 'max'] as const;

const GLYPH_BOX = 14;

export function glyphSize(format: MotionFormat): { width: number; height: number } {
  const { width, height } = FORMATS[format];
  const scale = GLYPH_BOX / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function filterHref(search: SearchParams, key: FilterKey, value: string | null): string {
  const next = { ...search, [key]: value ?? undefined };
  const params = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''));
  const query = params.toString();
  return query ? `${GALLERY_PATH}?${query}` : GALLERY_PATH;
}

export function rangeHref(search: SearchParams, range: { min: number; max: number }): string {
  const open = { min: range.min <= 0, max: range.max >= SLIDER_MAX };
  return filterHref({ ...search, min: open.min ? undefined : String(range.min) }, 'max', open.max ? null : String(range.max));
}

export function resultCount(n: number): string {
  if (!n) {
    return 'No videos';
  }
  return n === 1 ? '1 video' : `${n} videos`;
}
