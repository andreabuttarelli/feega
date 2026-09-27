import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { syncedSourceItems } from './synced-items';

const ORG = '11111111-1111-1111-1111-111111111111';
const NODE = '22222222-2222-2222-2222-222222222222';

const source = (type: string, data: Record<string, unknown>) =>
  ({ id: NODE, canvasId: 'c', projectId: 'p', type, displayName: null, x: 0, y: 0, z: 0, width: null, height: null, data, version: 1 }) as never;

const productRow = (id: string, title: string, available: boolean, price: number) => ({
  id,
  org_id: ORG,
  node_id: NODE,
  project_id: 'p',
  platform: 'shopify',
  external_id: id,
  handle: id,
  title,
  description: null,
  price,
  currency: 'EUR',
  url: null,
  images: [{ url: `canvas-assets/${id}.png` }],
  available,
  synced_at: 'now',
  created_at: 'now'
});

const postRow = (id: string, caption: string, type: string, likes: number) => ({
  id,
  org_id: ORG,
  node_id: NODE,
  project_id: 'p',
  platform: 'instagram',
  external_id: id,
  handle: 'acme',
  caption,
  media: { type, items: [{ type, url: `canvas-assets/${id}.png` }] },
  metrics: { likes },
  permalink: null,
  posted_at: '2026-09-01T00:00:00Z',
  fetched_at: 'now'
});

describe('gli item di una sorgente sincronizzata rispettano i filtri del nodo', () => {
  it('products: solo disponibili, ordinati per prezzo', async () => {
    const { db } = fakeDb({
      products: [productRow('a', 'Sedia', false, 10), productRow('b', 'Tavolo', true, 90), productRow('c', 'Lampada', true, 30)]
    });

    const items = await syncedSourceItems(db, ORG, source('products', { type: 'shopify', url: '', filters: { in_stock_only: true, sort: 'price_asc' } }));

    expect(items.map((i) => i.text)).toEqual(['Lampada', 'Tavolo']);
  });

  it('social_account_feed: solo video sopra una soglia di like', async () => {
    const { db } = fakeDb({
      social_posts: [postRow('a', 'foto', 'image', 900), postRow('b', 'clip piccola', 'video', 10), postRow('c', 'clip virale', 'video', 5000)]
    });

    const items = await syncedSourceItems(
      db,
      ORG,
      source('social_account_feed', { platform: 'instagram', handle: 'acme', filters: { media: 'video', min_likes: 100 } })
    );

    expect(items.map((i) => i.text)).toEqual(['clip virale']);
  });

  it('senza filtri restano tutte le righe', async () => {
    const { db } = fakeDb({ products: [productRow('a', 'Sedia', false, 10), productRow('b', 'Tavolo', true, 90)] });

    const items = await syncedSourceItems(db, ORG, source('products', { type: 'shopify', url: '' }));

    expect(items).toHaveLength(2);
  });
});
