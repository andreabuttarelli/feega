export const CANVAS_DRAG_FEED_IMAGE = 'application/x-feega-feed-image';

export const FEED_IMAGE_LONG_SIDE = 360;

export enum FeedSource {
  Post = 'post',
  Product = 'product'
}

export const FEED_SOURCE_OF_NODE: Record<string, FeedSource | undefined> = {
  social_account_feed: FeedSource.Post,
  products: FeedSource.Product
};

export type FeedImageDrag = {
  nodeId: string;
  itemId: string;
  imageIndex: number;
  thumb: string;
  w: number;
  h: number;
};

export type FeedImageRef = Pick<FeedImageDrag, 'nodeId' | 'itemId' | 'imageIndex'>;

export const serializeFeedImageDrag = (drag: FeedImageDrag): string => JSON.stringify(drag);

const isPositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

export function parseFeedImageDrag(raw: string): FeedImageDrag | null {
  try {
    const parsed = JSON.parse(raw) as Partial<FeedImageDrag> | null;
    if (!parsed || typeof parsed.nodeId !== 'string' || typeof parsed.itemId !== 'string' || typeof parsed.thumb !== 'string') {
      return null;
    }
    if (!Number.isInteger(parsed.imageIndex) || (parsed.imageIndex as number) < 0 || !isPositive(parsed.w) || !isPositive(parsed.h)) {
      return null;
    }
    return { nodeId: parsed.nodeId, itemId: parsed.itemId, imageIndex: parsed.imageIndex as number, thumb: parsed.thumb, w: parsed.w, h: parsed.h };
  } catch {
    return null;
  }
}

export function feedImageSize(natural: { w: number; h: number }): { w: number; h: number } {
  if (!isPositive(natural.w) || !isPositive(natural.h)) {
    return { w: FEED_IMAGE_LONG_SIDE, h: FEED_IMAGE_LONG_SIDE };
  }
  const k = FEED_IMAGE_LONG_SIDE / Math.max(natural.w, natural.h);
  return { w: Math.round(natural.w * k), h: Math.round(natural.h * k) };
}

type PostItem = { type?: unknown; url?: unknown; thumbnailUrl?: unknown };

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

export function postImageUrl(post: { media?: { items?: unknown; thumbnailUrl?: unknown } | null }, index: number): string | null {
  const items = Array.isArray(post.media?.items) ? (post.media.items as PostItem[]) : [];
  if (!items.length) {
    return index === 0 ? text(post.media?.thumbnailUrl) : null;
  }
  const item = items[index];
  if (!item) {
    return null;
  }
  return item.type === 'video' ? text(item.thumbnailUrl) : (text(item.url) ?? text(item.thumbnailUrl));
}

export function productImageUrl(product: { images: { url: string }[] }, index: number): string | null {
  return text(product.images[index]?.url);
}
