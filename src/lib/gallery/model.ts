import { z } from 'zod';
import { GALLERY_PATH } from './paths';
import { everyClip, formatOf, FORMATS, MOTION_FORMATS, type AssetRef, type MotionDoc, type MotionFormat } from '$lib/motion/doc';

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
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE).default(PAGE_SIZE)
});

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

type FilterKey = 'format' | 'duration' | 'kind';

export type FilterGroup = { key: FilterKey; label: string; options: { value: string; label: string }[] };

export const FILTER_GROUPS: readonly FilterGroup[] = [
  { key: 'kind', label: 'Type', options: (Object.keys(KIND_LABEL) as GalleryKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] })) },
  { key: 'format', label: 'Format', options: MOTION_FORMATS.map((f) => ({ value: f, label: FORMATS[f].label })) },
  { key: 'duration', label: 'Length', options: (Object.keys(DURATION_BANDS) as DurationBand[]).map((d) => ({ value: d, label: DURATION_BANDS[d].label })) }
];

export function filterHref(search: Partial<Record<FilterKey | 'q' | 'tag', string | undefined>>, key: FilterKey | 'tag', value: string | null): string {
  const next = { ...search, [key]: value ?? undefined };
  const params = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''));
  const query = params.toString();
  return query ? `${GALLERY_PATH}?${query}` : GALLERY_PATH;
}
