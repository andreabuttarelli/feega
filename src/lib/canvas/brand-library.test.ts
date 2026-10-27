import { describe, expect, it } from 'vitest';
import { LibraryTab, LIBRARY_TABS, engagement, firstMedia, libraryDrag, type LibraryItem } from './brand-library';

const item = (over: Partial<LibraryItem> = {}): LibraryItem => ({ id: 'i', title: 'Cold brew', subtitle: '€4.00', assetId: null, mediaType: null, ...over });

describe('LIBRARY_TABS', () => {
  it('is Kit, Products, Posts, Ads in this order', () => {
    expect(LIBRARY_TABS).toEqual([LibraryTab.Kit, LibraryTab.Products, LibraryTab.Posts, LibraryTab.Ads]);
  });
});

describe('libraryDrag', () => {
  it('an image becomes a static image node carrying its asset', () => {
    const drag = libraryDrag(item({ assetId: 'a1', mediaType: 'image' }));
    expect(drag?.type).toBe('image');
    expect(drag?.data).toMatchObject({ assetId: 'a1' });
  });

  it('a video becomes a video node', () => {
    expect(libraryDrag(item({ assetId: 'v1', mediaType: 'video' }))?.type).toBe('video');
  });

  it('an item without media becomes a text node with its title and subtitle', () => {
    const drag = libraryDrag(item());
    expect(drag?.type).toBe('text');
    expect(drag?.data).toEqual({ prompt: 'Cold brew\n\n€4.00' });
  });
});

describe('firstMedia', () => {
  it('finds the first http url in any jsonb shape and reads its kind', () => {
    expect(firstMedia([{ url: 'https://x/a.jpg' }])).toEqual({ url: 'https://x/a.jpg', type: 'image' });
    expect(firstMedia({ items: [{ type: 'video', url: 'https://x/v' }] })).toEqual({ url: 'https://x/v', type: 'video' });
    expect(firstMedia({ video_url: 'https://x/clip.mp4' })).toEqual({ url: 'https://x/clip.mp4', type: 'video' });
  });

  it('returns null when nothing looks like a url', () => {
    expect(firstMedia(null)).toBeNull();
    expect(firstMedia({ caption: 'hi' })).toBeNull();
  });
});

describe('engagement', () => {
  it('sums the numeric metrics, ignoring anything else', () => {
    expect(engagement({ likes: 10, comments: 2, views: '7', note: 'x' })).toBe(12);
    expect(engagement(null)).toBe(0);
  });
});
