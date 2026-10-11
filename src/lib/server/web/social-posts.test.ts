import { describe, expect, it } from 'vitest';
import type { NormalizedPost } from '$lib/server/scrapecreators';
import { ItemKind, profileAccount, socialItem } from './social-posts';

const post = (over: Partial<NormalizedPost>): NormalizedPost => ({
  externalId: '1',
  url: 'https://www.instagram.com/p/1/',
  content: 'hello',
  mediaType: 'image',
  thumbnailUrl: 'https://cdn.example/t.jpg',
  publishedAt: '2026-10-01T00:00:00.000Z',
  metrics: { likes: 10, comments: 2, views: null },
  ...over
});

describe('social items', () => {
  it('a single picture is an image with its url', () => {
    expect(socialItem('instagram', post({ items: [{ type: 'image', url: 'https://cdn.example/a.jpg', thumbnailUrl: 'https://cdn.example/a-t.jpg' }] }))).toEqual({
      platform: 'instagram',
      id: '1',
      url: 'https://www.instagram.com/p/1/',
      kind: ItemKind.Image,
      caption: 'hello',
      images: ['https://cdn.example/a.jpg'],
      video: null,
      seconds: null,
      publishedAt: '2026-10-01T00:00:00.000Z',
      likes: 10,
      comments: 2,
      views: null
    });
  });

  it('several slides are a carousel; a video slide gives its cover as picture', () => {
    const item = socialItem(
      'instagram',
      post({
        items: [
          { type: 'image', url: 'https://cdn.example/a.jpg', thumbnailUrl: null },
          { type: 'video', url: 'https://cdn.example/b.mp4', thumbnailUrl: 'https://cdn.example/b.jpg' }
        ]
      })
    );

    expect(item).toMatchObject({ kind: ItemKind.Carousel, images: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'], video: 'https://cdn.example/b.mp4' });
  });

  it('a video carries its playable url, length in seconds and views', () => {
    const item = socialItem('tiktok', post({ mediaType: 'video', items: [], videoUrl: 'https://cdn.example/v.mp4', durationMs: 15400, metrics: { views: 900, likes: 5, comments: 1 } }));

    expect(item).toMatchObject({ kind: ItemKind.Video, images: ['https://cdn.example/t.jpg'], video: 'https://cdn.example/v.mp4', seconds: 15, views: 900 });
  });

  it('a post with no media is text', () => {
    expect(socialItem('x', post({ mediaType: 'text', thumbnailUrl: null })).kind).toBe(ItemKind.Text);
  });

  it('an account is a handle, an @handle or a profile url', () => {
    expect(profileAccount('instagram', '@studio.x')).toEqual({ ok: true, platform: 'instagram', account: { username: 'studio.x', profileUrl: null } });
    expect(profileAccount('instagram', 'https://www.instagram.com/studio.x/')).toEqual({ ok: true, platform: 'instagram', account: { username: 'studio.x', profileUrl: 'https://www.instagram.com/studio.x/' } });
    expect(profileAccount('instagram', 'https://www.tiktok.com/@maker')).toMatchObject({ ok: true, platform: 'tiktok', account: { username: 'maker' } });
    expect(profileAccount('instagram', 'https://www.instagram.com/p/abc/')).toMatchObject({ ok: false });
  });
});
