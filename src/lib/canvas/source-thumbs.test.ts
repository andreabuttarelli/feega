import { describe, expect, it } from 'vitest';
import { TileBadge, feedView, personView, postThumb } from './source-thumbs';

describe('source thumbs — the picture a source tile shows per item', () => {
  it('a post shows its first carousel item, else its cover', () => {
    expect(postThumb({ media: { items: [{ thumbnailUrl: 'a' }], thumbnailUrl: 'b' } })).toBe('a');
    expect(postThumb({ media: { thumbnailUrl: 'b' } })).toBe('b');
    expect(postThumb({ media: null })).toBeNull();
  });
});

describe('source views — what a card shows of what a source read', () => {
  it('a feed tile carries the badge of its media kind', () => {
    const post = (media: Record<string, unknown>) => ({ media });
    const view = feedView([post({ type: 'video' }), post({ items: [{}, {}] }), post({})], 9);

    expect(view.tiles.map((t) => t.badge)).toEqual([TileBadge.Video, TileBadge.Carousel, null]);
    expect(view.total).toBe(9);
  });

  it('a person view names the influencer and counts its views', () => {
    expect(personView('Giulia', [{ url: 'x' }, { url: null }])).toMatchObject({ name: 'Giulia', total: 2 });
  });
});
