import type { ConnectorType } from './connectors';

export type SelectableItem = {
  text: string | null;
  mediaUrls: string[];
};

export type FieldValue = SelectableItem;

export type PostRow = {
  caption: string | null;
  media: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  permalink?: string | null;
  postedAt?: string | null;
  handle?: string | null;
};

export type SyncedSourceType = 'social_account_feed';

type RowOf = { social_account_feed: PostRow };

export type OutputPort = Extract<ConnectorType, 'text' | 'images' | 'videos' | 'audios'>;

export type SourceField<Row> = {
  key: string;
  label: string;
  port: OutputPort;
  extract: (row: Row) => FieldValue;
};

type MediaSlide = { type?: string; url?: string; thumbnailUrl?: string };

const NOTHING: FieldValue = { text: null, mediaUrls: [] };

const text = (value: unknown): FieldValue => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { text: String(value), mediaUrls: [] };
  }
  if (typeof value === 'string' && value.trim()) {
    return { text: value, mediaUrls: [] };
  }
  return NOTHING;
};

const media = (urls: string[]): FieldValue => ({ text: null, mediaUrls: urls });

const stillOf = (slide: MediaSlide): string | undefined =>
  slide.type === 'video' ? slide.thumbnailUrl : (slide.url ?? slide.thumbnailUrl);

const slidesOf = (row: PostRow): MediaSlide[] =>
  Array.isArray(row.media?.items) ? (row.media.items as MediaSlide[]) : [];

function stillsOf(row: PostRow): string[] {
  const slides = slidesOf(row);
  if (slides.length) {
    return slides.map(stillOf).filter((url): url is string => Boolean(url));
  }

  const cover = row.media?.thumbnailUrl;
  return typeof cover === 'string' && cover ? [cover] : [];
}

function videosOf(row: PostRow): string[] {
  const clips = slidesOf(row)
    .filter((slide) => slide.type === 'video' && slide.url)
    .map((slide) => slide.url as string);
  if (clips.length) {
    return clips;
  }

  const clip = row.media?.videoUrl;
  return typeof clip === 'string' && clip ? [clip] : [];
}

const HASHTAG = /#[\p{L}\p{N}_]+/gu;

function hashtagsOf(row: PostRow): FieldValue {
  const saved = Array.isArray(row.media?.hashtags) ? (row.media.hashtags as unknown[]).filter((t): t is string => typeof t === 'string') : [];
  const tags = saved.length ? saved.map((t) => `#${t.replace(/^#/, '')}`) : (row.caption?.match(HASHTAG) ?? []);
  return text(tags.join(' '));
}

const metric = (key: string) => (row: PostRow) => text(row.metrics?.[key]);

const joined = (...parts: Array<string | null | undefined>) =>
  text(parts.filter((part): part is string => Boolean(part?.trim())).join('\n\n'));

export const SOURCE_ITEM_FIELDS: { [T in SyncedSourceType]: readonly SourceField<RowOf[T]>[] } = {
  social_account_feed: [
    { key: 'media', label: 'Media', port: 'images', extract: (p) => media(stillsOf(p)) },
    { key: 'first_slide', label: 'First slide', port: 'images', extract: (p) => media(stillsOf(p).slice(0, 1)) },
    { key: 'video', label: 'Video', port: 'videos', extract: (p) => media(videosOf(p)) },
    { key: 'caption', label: 'Caption', port: 'text', extract: (p) => text(p.caption) },
    { key: 'hashtags', label: 'Hashtags', port: 'text', extract: hashtagsOf },
    { key: 'likes', label: 'Likes', port: 'text', extract: metric('likes') },
    { key: 'views', label: 'Views', port: 'text', extract: metric('views') },
    { key: 'comments', label: 'Comments', port: 'text', extract: metric('comments') },
    { key: 'posted_at', label: 'Posted at', port: 'text', extract: (p) => text(p.postedAt) },
    { key: 'url', label: 'URL', port: 'text', extract: (p) => text(p.permalink) },
    { key: 'author', label: 'Author', port: 'text', extract: (p) => text(p.handle ? `@${p.handle}` : null) }
  ]
};

export function isSyncedSourceType(type: string | null | undefined): type is SyncedSourceType {
  return type === 'social_account_feed';
}

export function fieldOf<T extends SyncedSourceType>(type: T, key: string): SourceField<RowOf[T]> | null {
  return (SOURCE_ITEM_FIELDS[type] as readonly SourceField<RowOf[T]>[]).find((f) => f.key === key) ?? null;
}

export function fieldValue<T extends SyncedSourceType>(type: T, key: string, row: RowOf[T]): FieldValue | null {
  const field = fieldOf(type, key);
  return field ? field.extract(row) : null;
}

export const DEFAULT_FIELDS: Record<SyncedSourceType, { images: string; text: string; videos?: string }> = {
  social_account_feed: { images: 'media', text: 'caption', videos: 'video' }
};

function itemOf<T extends SyncedSourceType>(type: T, row: RowOf[T]): SelectableItem {
  const fields = DEFAULT_FIELDS[type];
  return { text: fieldValue(type, fields.text, row)!.text, mediaUrls: fieldValue(type, fields.images, row)!.mediaUrls };
}

export function socialPostItem(post: PostRow): SelectableItem {
  return itemOf('social_account_feed', post);
}
