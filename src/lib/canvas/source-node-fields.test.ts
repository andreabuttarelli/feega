import { describe, expect, it } from 'vitest';
import { newNodeRow, productsData, productsOf, socialFeedData, socialFeedOf } from '$lib/canvas-node-data';
import { NODE_DATA_SCHEMAS, describeNodeType } from './node-data';
import { DEFAULT_FEED_FILTERS, DEFAULT_PRODUCT_FILTERS } from './source-filters';

describe('products: categoria e filtri', () => {
  it('una riga di prima, senza filtri, si legge coi default', () => {
    const node = productsOf({ id: 'p', type: 'products', data: { type: 'shopify', url: 'https://s.com', limit: 20 } });
    expect(node?.category).toBe('');
    expect(node?.filters).toEqual(DEFAULT_PRODUCT_FILTERS);
    expect(NODE_DATA_SCHEMAS.products.safeParse({ type: 'shopify', url: '' }).success).toBe(true);
  });

  it('filtri e categoria fanno andata e ritorno', () => {
    const filters = { ...DEFAULT_PRODUCT_FILTERS, query: 'shoe', price_max: 90, sort: 'price_asc' as const };
    const node = productsOf({ id: 'p', type: 'products', data: { type: 'shopify', url: '', category: 'sale', filters } })!;
    const data = productsData(node);
    expect(data.filters).toEqual(filters);
    expect(data.category).toBe('sale');
    expect(NODE_DATA_SCHEMAS.products.safeParse(data).success).toBe(true);
  });

  it('lo schema rifiuta un ordinamento inesistente', () => {
    expect(NODE_DATA_SCHEMAS.products.safeParse({ type: 'shopify', url: '', filters: { sort: 'random' } }).success).toBe(false);
  });

  it('un nodo nuovo nasce valido', () => {
    expect(NODE_DATA_SCHEMAS.products.safeParse(newNodeRow('products')).success).toBe(true);
  });

  it('describe_node_types mostra i filtri', () => {
    expect(JSON.stringify(describeNodeType('products'))).toContain('in_stock_only');
    expect(JSON.stringify(describeNodeType('products'))).toContain('category');
  });
});

describe('social_account_feed: filtri', () => {
  it('una riga di prima si legge coi default', () => {
    const node = socialFeedOf({ id: 'f', type: 'social_account_feed', data: { platform: 'instagram', handle: 'nike' } });
    expect(node?.filters).toEqual(DEFAULT_FEED_FILTERS);
  });

  it('i filtri fanno andata e ritorno e passano lo schema', () => {
    const filters = { ...DEFAULT_FEED_FILTERS, media: 'video' as const, min_likes: 1000, from: '2026-01-01' };
    const node = socialFeedOf({ id: 'f', type: 'social_account_feed', data: { platform: 'tiktok', handle: 'nike', filters } })!;
    const data = socialFeedData(node);
    expect(data.filters).toEqual(filters);
    expect(NODE_DATA_SCHEMAS.social_account_feed.safeParse(data).success).toBe(true);
  });

  it('lo schema rifiuta una data non ISO', () => {
    expect(
      NODE_DATA_SCHEMAS.social_account_feed.safeParse({ platform: 'x', handle: 'a', filters: { from: '01/02/2026' } }).success
    ).toBe(false);
  });

  it('un nodo nuovo nasce valido e describe_node_types mostra i filtri', () => {
    expect(NODE_DATA_SCHEMAS.social_account_feed.safeParse(newNodeRow('social_account_feed')).success).toBe(true);
    expect(JSON.stringify(describeNodeType('social_account_feed'))).toContain('min_views');
  });
});
