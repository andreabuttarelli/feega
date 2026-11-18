import { describe, expect, it } from 'vitest';
import {
  CANVAS_DRAG_FEED_IMAGE,
  FEED_IMAGE_LONG_SIDE,
  FeedSource,
  feedImageSize,
  parseFeedImageDrag,
  postImageUrl,
  productImageUrl,
  serializeFeedImageDrag
} from './feed-image';

const DRAG = { nodeId: 'n1', itemId: 'p1', imageIndex: 0, thumb: 'https://cdn.test/t.jpg', w: 1080, h: 1350 };

describe('the drag of a feed or product picture', () => {
  it('travels under its own mime type', () => {
    expect(CANVAS_DRAG_FEED_IMAGE).toBe('application/x-feega-feed-image');
  });

  it('survives the dataTransfer round trip', () => {
    expect(parseFeedImageDrag(serializeFeedImageDrag(DRAG))).toEqual(DRAG);
  });

  it('refuses a payload that is not a picture of a node item', () => {
    expect(parseFeedImageDrag('')).toBeNull();
    expect(parseFeedImageDrag('{"nodeId":"n1"}')).toBeNull();
    expect(parseFeedImageDrag(JSON.stringify({ ...DRAG, imageIndex: -1 }))).toBeNull();
    expect(parseFeedImageDrag(JSON.stringify({ ...DRAG, w: 0 }))).toBeNull();
  });
});

describe('the size of the node a picture becomes', () => {
  it('keeps the aspect ratio with the long side fixed', () => {
    expect(feedImageSize({ w: 1080, h: 1350 })).toEqual({ w: FEED_IMAGE_LONG_SIDE * 0.8, h: FEED_IMAGE_LONG_SIDE });
    expect(feedImageSize({ w: 1600, h: 900 })).toEqual({ w: FEED_IMAGE_LONG_SIDE, h: Math.round((FEED_IMAGE_LONG_SIDE * 9) / 16) });
  });

  it('falls back to a square when the size is unknown', () => {
    expect(feedImageSize({ w: 0, h: 0 })).toEqual({ w: FEED_IMAGE_LONG_SIDE, h: FEED_IMAGE_LONG_SIDE });
  });
});

describe('which url a post or a product gives', () => {
  it('takes the full still of an image post', () => {
    const media = { items: [{ type: 'image', url: 'https://cdn.test/full.jpg', thumbnailUrl: 'https://cdn.test/t.jpg' }] };
    expect(postImageUrl({ media }, 0)).toBe('https://cdn.test/full.jpg');
  });

  it('takes the poster of a video post, never the video file', () => {
    const media = { items: [{ type: 'video', url: 'https://cdn.test/v.mp4', thumbnailUrl: 'https://cdn.test/poster.jpg' }] };
    expect(postImageUrl({ media }, 0)).toBe('https://cdn.test/poster.jpg');
  });

  it('picks the slide of a carousel and refuses one that is not there', () => {
    const media = { items: [{ type: 'image', url: 'a' }, { type: 'image', url: 'https://cdn.test/b.jpg' }] };
    expect(postImageUrl({ media }, 1)).toBe('https://cdn.test/b.jpg');
    expect(postImageUrl({ media }, 2)).toBeNull();
  });

  it('falls back to the cover when a post has no items', () => {
    expect(postImageUrl({ media: { thumbnailUrl: 'https://cdn.test/cover.jpg' } }, 0)).toBe('https://cdn.test/cover.jpg');
    expect(postImageUrl({ media: null }, 0)).toBeNull();
  });

  it('takes the product image at the index', () => {
    const images = [{ url: 'https://shop.test/a.jpg' }, { url: 'https://shop.test/b.jpg' }];
    expect(productImageUrl({ images }, 1)).toBe('https://shop.test/b.jpg');
    expect(productImageUrl({ images }, 5)).toBeNull();
  });

  it('names the two sources', () => {
    expect(Object.values(FeedSource)).toEqual(['post', 'product']);
  });
});
