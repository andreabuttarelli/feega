import { describe, expect, it } from 'vitest';
import {
  filterPosts,
  feedFiltersOf,
  normalizeHandle,
  DEFAULT_FEED_FILTERS
} from './source-filters';

const post = (
  caption: string,
  postedAt: string | null,
  metrics: Record<string, number | null>,
  media: Record<string, unknown> | null = { type: 'image', items: [{ type: 'image' }] }
) => ({ caption, postedAt, metrics, media });

describe('filtri del feed', () => {
  const video = { type: 'video', items: [{ type: 'video' }] };
  const carousel = { type: 'image', items: [{ type: 'image' }, { type: 'image' }] };
  const feed = [
    post('New drop #run', '2026-09-20T10:00:00Z', { likes: 500, views: 9000 }, video),
    post('Classic look', '2026-09-10T10:00:00Z', { likes: 1500, views: null }),
    post('Swipe for more #run', '2026-08-01T10:00:00Z', { likes: 50 }, carousel),
    post('Giveaway', null, {})
  ];

  it('senza filtri tiene tutto', () => {
    expect(filterPosts(feed, DEFAULT_FEED_FILTERS)).toEqual(feed);
  });

  it('il tipo di media distingue immagine, video e carosello', () => {
    expect(filterPosts(feed, { ...DEFAULT_FEED_FILTERS, media: 'video' }).map((p) => p.caption)).toEqual(['New drop #run']);
    expect(filterPosts(feed, { ...DEFAULT_FEED_FILTERS, media: 'carousel' }).map((p) => p.caption)).toEqual(['Swipe for more #run']);
    expect(filterPosts(feed, { ...DEFAULT_FEED_FILTERS, media: 'image' }).map((p) => p.caption)).toEqual(['Classic look', 'Giveaway']);
  });

  it('like e visualizzazioni minime escludono chi non ha il numero', () => {
    expect(filterPosts(feed, { ...DEFAULT_FEED_FILTERS, min_likes: 400 }).map((p) => p.caption)).toEqual(['New drop #run', 'Classic look']);
    expect(filterPosts(feed, { ...DEFAULT_FEED_FILTERS, min_views: 1 }).map((p) => p.caption)).toEqual(['New drop #run']);
  });

  it('le date sono inclusive e un post senza data esce da un intervallo', () => {
    expect(filterPosts(feed, { ...DEFAULT_FEED_FILTERS, from: '2026-09-10', to: '2026-09-20' }).map((p) => p.caption)).toEqual([
      'New drop #run',
      'Classic look'
    ]);
  });

  it('parole da includere (una qualsiasi) e da escludere, separate da virgola', () => {
    expect(filterPosts(feed, { ...DEFAULT_FEED_FILTERS, include: '#run, giveaway' }).map((p) => p.caption)).toEqual([
      'New drop #run',
      'Swipe for more #run',
      'Giveaway'
    ]);
    expect(filterPosts(feed, { ...DEFAULT_FEED_FILTERS, include: '#run', exclude: 'swipe' }).map((p) => p.caption)).toEqual(['New drop #run']);
  });

  it('ordina per like e per visualizzazioni', () => {
    expect(filterPosts(feed, { ...DEFAULT_FEED_FILTERS, sort: 'most_liked' }).map((p) => p.caption)[0]).toBe('Classic look');
    expect(filterPosts(feed, { ...DEFAULT_FEED_FILTERS, sort: 'most_viewed' }).map((p) => p.caption)[0]).toBe('New drop #run');
  });

  it('ordina per data, i più recenti prima', () => {
    const shuffled = [feed[2], feed[3], feed[0], feed[1]];
    expect(filterPosts(shuffled, { ...DEFAULT_FEED_FILTERS, sort: 'newest' }).map((p) => p.caption)).toEqual([
      'New drop #run',
      'Classic look',
      'Swipe for more #run',
      'Giveaway'
    ]);
  });

  it('un jsonb sporco diventa i filtri di default', () => {
    expect(feedFiltersOf(null)).toEqual(DEFAULT_FEED_FILTERS);
    expect(feedFiltersOf({ media: 'gif', min_likes: '3', from: 7 })).toEqual(DEFAULT_FEED_FILTERS);
    expect(feedFiltersOf({ media: 'video', min_likes: 100 })).toEqual({ ...DEFAULT_FEED_FILTERS, media: 'video', min_likes: 100 });
  });
});

describe('handle', () => {
  it.each([
    ['nike', 'nike'],
    ['@nike', 'nike'],
    ['  @nike  ', 'nike'],
    ['https://www.instagram.com/nike/', 'nike'],
    ['instagram.com/nike?hl=en', 'nike'],
    ['https://www.tiktok.com/@nike', 'nike'],
    ['https://www.youtube.com/@nike/videos', 'nike'],
    ['https://www.linkedin.com/company/nike/', 'nike'],
    ['https://x.com/Nike', 'Nike'],
    ['', '']
  ])('%s → %s', (raw, handle) => {
    expect(normalizeHandle(raw)).toBe(handle);
  });
});
