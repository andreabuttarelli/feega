import { mediaKindOf } from './source-filters';

type PostMedia = { items?: unknown; thumbnailUrl?: unknown } | null | undefined;

export function postThumb(post: { media?: PostMedia }): string | null {
  const items = Array.isArray(post.media?.items) ? (post.media.items as { thumbnailUrl?: string | null }[]) : [];
  const cover = post.media?.thumbnailUrl;
  return items[0]?.thumbnailUrl ?? (typeof cover === 'string' ? cover : null);
}

export enum TileBadge {
  Carousel = 'carousel',
  Video = 'video'
}

export type SourceTile = { thumb: string | null; caption: string | null; badge: TileBadge | null; sale: string | null };

export type SourceView = { tiles: SourceTile[]; total: number; name: string | null };

const BADGE_OF_MEDIA = { carousel: TileBadge.Carousel, video: TileBadge.Video, image: null } as const;

type PostLike = { media: Record<string, unknown> | null };

export const feedView = (posts: PostLike[], total: number): SourceView => ({
  tiles: posts.map((post) => ({ thumb: postThumb(post), caption: null, badge: BADGE_OF_MEDIA[mediaKindOf(post.media)], sale: null })),
  total,
  name: null
});

export const personView = (name: string, views: { url: string | null }[]): SourceView => ({
  tiles: views.map((v) => ({ thumb: v.url, caption: null, badge: null, sale: null })),
  total: views.length,
  name
});
