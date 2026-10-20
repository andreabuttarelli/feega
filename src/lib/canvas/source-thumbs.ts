import { mediaKindOf } from './source-filters';
import { saleLabel } from './product-discount';

type PostMedia = { items?: unknown; thumbnailUrl?: unknown } | null | undefined;

export function postThumb(post: { media?: PostMedia }): string | null {
  const items = Array.isArray(post.media?.items) ? (post.media.items as { thumbnailUrl?: string | null }[]) : [];
  const cover = post.media?.thumbnailUrl;
  return items[0]?.thumbnailUrl ?? (typeof cover === 'string' ? cover : null);
}

export function productThumb(product: { images: { url: string }[] }): string | null {
  return product.images[0]?.url ?? null;
}

export enum TileBadge {
  Carousel = 'carousel',
  Video = 'video'
}

export type SourceTile = { thumb: string | null; caption: string | null; badge: TileBadge | null; sale: string | null };

export type SourceView = { tiles: SourceTile[]; total: number; name: string | null };

const BADGE_OF_MEDIA = { carousel: TileBadge.Carousel, video: TileBadge.Video, image: null } as const;

const priceLabel = (p: { price: number | null; currency: string | null }): string | null => (p.price === null ? null : `${p.price.toFixed(2)}${p.currency ? ` ${p.currency}` : ''}`);

type PostLike = { media: Record<string, unknown> | null };

type ProductLike = { images: { url: string }[]; price: number | null; compareAtPrice: number | null; currency: string | null };

export const feedView = (posts: PostLike[], total: number): SourceView => ({
  tiles: posts.map((post) => ({ thumb: postThumb(post), caption: null, badge: BADGE_OF_MEDIA[mediaKindOf(post.media)], sale: null })),
  total,
  name: null
});

export const productsView = (products: ProductLike[], total: number): SourceView => ({
  tiles: products.map((p) => ({ thumb: productThumb(p), caption: priceLabel(p), badge: p.images.length > 1 ? TileBadge.Carousel : null, sale: saleLabel(p.price, p.compareAtPrice) })),
  total,
  name: null
});

export const personView = (name: string, views: { url: string | null }[]): SourceView => ({
  tiles: views.map((v) => ({ thumb: v.url, caption: null, badge: null, sale: null })),
  total: views.length,
  name
});
