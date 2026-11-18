import { describe, expect, it } from 'vitest';
import {
  filterPosts,
  filterProducts,
  feedFiltersOf,
  normalizeHandle,
  productFiltersOf,
  DEFAULT_FEED_FILTERS,
  DEFAULT_PRODUCT_FILTERS
} from './source-filters';

const product = (title: string, price: number | null, available: boolean | null, description: string | null = null) => ({
  title,
  description,
  price,
  available
});

const post = (
  caption: string,
  postedAt: string | null,
  metrics: Record<string, number | null>,
  media: Record<string, unknown> | null = { type: 'image', items: [{ type: 'image' }] }
) => ({ caption, postedAt, metrics, media });

describe('filtri dei prodotti', () => {
  const catalog = [
    product('Red shoe', 120, true, 'leather'),
    product('Blue hat', 30, false),
    product('Green shoe', 80, true),
    product('Free sticker', null, true)
  ];

  it('senza filtri tiene tutto, nello stesso ordine', () => {
    expect(filterProducts(catalog, DEFAULT_PRODUCT_FILTERS)).toEqual(catalog);
  });

  it('il testo cerca in titolo e descrizione, senza maiuscole', () => {
    expect(filterProducts(catalog, { ...DEFAULT_PRODUCT_FILTERS, query: 'SHOE' }).map((p) => p.title)).toEqual(['Red shoe', 'Green shoe']);
    expect(filterProducts(catalog, { ...DEFAULT_PRODUCT_FILTERS, query: 'leather' }).map((p) => p.title)).toEqual(['Red shoe']);
  });

  it('il prezzo min/max esclude chi non ha prezzo', () => {
    expect(filterProducts(catalog, { ...DEFAULT_PRODUCT_FILTERS, price_min: 50, price_max: 100 }).map((p) => p.title)).toEqual(['Green shoe']);
  });

  it('solo disponibili', () => {
    expect(filterProducts(catalog, { ...DEFAULT_PRODUCT_FILTERS, in_stock_only: true }).map((p) => p.title)).toEqual([
      'Red shoe',
      'Green shoe',
      'Free sticker'
    ]);
  });

  it('ordina per prezzo e titolo, senza toccare l’array originale', () => {
    const snapshot = [...catalog];
    expect(filterProducts(catalog, { ...DEFAULT_PRODUCT_FILTERS, sort: 'price_asc' }).map((p) => p.price)).toEqual([30, 80, 120, null]);
    expect(filterProducts(catalog, { ...DEFAULT_PRODUCT_FILTERS, sort: 'price_desc' }).map((p) => p.price)).toEqual([120, 80, 30, null]);
    expect(filterProducts(catalog, { ...DEFAULT_PRODUCT_FILTERS, sort: 'title' }).map((p) => p.title)).toEqual([
      'Blue hat',
      'Free sticker',
      'Green shoe',
      'Red shoe'
    ]);
    expect(catalog).toEqual(snapshot);
  });

  describe('tag, marca, tipo e saldi', () => {
    const shelf = [
      { ...product('Runner', 98, true), compareAtPrice: 140, tags: ['Sale', 'running'], vendor: 'Allbirds', productType: 'Shoes' },
      { ...product('Sock', 20, false), compareAtPrice: 20, tags: ['socks'], vendor: 'Allbirds', productType: 'Socks' },
      { ...product('Cap', 30, true), compareAtPrice: null, tags: [], vendor: 'Other', productType: null },
      product('Legacy', 10, true)
    ];
    const titles = (f: Partial<typeof DEFAULT_PRODUCT_FILTERS>) => filterProducts(shelf, { ...DEFAULT_PRODUCT_FILTERS, ...f }).map((p) => p.title);

    it('per tag, senza maiuscole', () => {
      expect(titles({ tag: 'sale' })).toEqual(['Runner']);
    });

    it('per marca e per tipo', () => {
      expect(titles({ vendor: 'allbirds' })).toEqual(['Runner', 'Sock']);
      expect(titles({ product_type: 'SHOES' })).toEqual(['Runner']);
    });

    it('solo in saldo tiene chi ha un barrato più alto del prezzo', () => {
      expect(titles({ on_sale_only: true })).toEqual(['Runner']);
    });

    it('solo in saldo e disponibili insieme', () => {
      expect(titles({ on_sale_only: true, in_stock_only: true })).toEqual(['Runner']);
    });

    it('i filtri nuovi sopravvivono al jsonb', () => {
      expect(productFiltersOf({ tag: 'sale', vendor: 'A', product_type: 'B', on_sale_only: true })).toEqual({
        ...DEFAULT_PRODUCT_FILTERS,
        tag: 'sale',
        vendor: 'A',
        product_type: 'B',
        on_sale_only: true
      });
    });
  });

  it('un jsonb sporco diventa i filtri di default', () => {
    expect(productFiltersOf(undefined)).toEqual(DEFAULT_PRODUCT_FILTERS);
    expect(productFiltersOf({ price_min: 'x', sort: 'nope', query: 3 })).toEqual(DEFAULT_PRODUCT_FILTERS);
    expect(productFiltersOf({ price_min: 5, sort: 'title', in_stock_only: true })).toEqual({
      ...DEFAULT_PRODUCT_FILTERS,
      price_min: 5,
      sort: 'title',
      in_stock_only: true
    });
  });
});

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
