import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => [{ orgId: 'org-1' }]) }));
vi.mock('$lib/server/projects/lookup', () => ({
  findReachableProject: vi.fn(async (_db: unknown, input: { projectId: string }) => (input.projectId === 'p1' ? { orgId: 'org-1', project: { id: 'p1' } } : null))
}));
vi.mock('$lib/server/repos/assets', async (original) => ({
  ...(await original<object>()),
  findOrCreateImportedAsset: vi.fn(async (_db: unknown, input: { url: string }) => ({ id: `asset:${input.url}` }))
}));

const { GET } = await import('./+server');

const rows = {
  brands: [{ id: 'b1', org_id: 'org-1' }],
  products: [{ id: 'pr1', org_id: 'org-1', brand_id: 'b1', title: 'Cold brew', price: 4, currency: 'EUR', images: [{ url: 'https://shop/cb.jpg' }], updated_at: '2026-10-01' }],
  posts: [{ id: 'po1', org_id: 'org-1', brand_id: 'b1', title: 'Launch', caption: 'New!', media: [{ assetId: 'a9', order: 0 }], status: 'ready', planned_for: null, created_at: '2026-10-02' }],
  social_accounts: [{ id: 's1', org_id: 'org-1', brand_id: 'b1', handle: 'acme', platform: 'instagram', status: 'connected' }],
  social_posts: [
    { id: 'sp1', org_id: 'org-1', handle: 'acme', platform: 'instagram', caption: 'low', media: { items: [{ type: 'image', url: 'https://ig/1.jpg' }] }, metrics: { likes: 1 }, posted_at: '2026-09-01' },
    { id: 'sp2', org_id: 'org-1', handle: 'acme', platform: 'instagram', caption: 'high', media: { items: [{ type: 'video', url: 'https://ig/2.mp4' }] }, metrics: { likes: 900 }, posted_at: '2026-09-02' },
    { id: 'sp3', org_id: 'org-1', handle: 'other', platform: 'instagram', caption: 'not ours', media: null, metrics: { likes: 5000 }, posted_at: '2026-09-03' }
  ],
  competitor_ads: [{ id: 'ad1', org_id: 'org-1', brand_id: 'b1', page_name: 'Rival', creative_title: 'Buy now', creative_body: null, media: [{ image_url: 'https://fb/ad.jpg' }], last_seen_at: '2026-10-03' }],
  assets: [{ id: 'a9', org_id: 'org-1', type: 'image' }]
};

async function call(tab: string, projectId = 'p1', brandId = 'b1') {
  const { db } = fakeDb(rows, { filter: true });
  const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => db };
  const res = await GET({ params: { projectId, brandId }, locals, url: new URL(`http://x/?tab=${tab}`) } as never);
  return { status: res.status, body: res.status === 200 ? await res.json() : null };
}

describe('GET agent/brands/[brandId]/library', () => {
  it('products carry an imported image asset and the price as subtitle', async () => {
    const { body } = await call('products');
    expect(body.items).toEqual([{ id: 'pr1', title: 'Cold brew', subtitle: '4 EUR', assetId: 'asset:https://shop/cb.jpg', mediaType: 'image' }]);
  });

  it('posts list the brand posts, then its top social posts by engagement', async () => {
    const { body } = await call('posts');
    expect(body.items.map((i: { id: string; group: string }) => [i.id, i.group])).toEqual([
      ['po1', 'Recent'],
      ['sp2', 'Top social'],
      ['sp1', 'Top social']
    ]);
    expect(body.items[0]).toMatchObject({ assetId: 'a9', mediaType: 'image' });
    expect(body.items[1]).toMatchObject({ assetId: 'asset:https://ig/2.mp4', mediaType: 'video' });
  });

  it('ads list competitor ads with their creative', async () => {
    const { body } = await call('ads');
    expect(body.items).toEqual([{ id: 'ad1', title: 'Rival', subtitle: 'Buy now', assetId: 'asset:https://fb/ad.jpg', mediaType: 'image' }]);
  });

  it('400 for an unknown tab, 404 for a brand or project out of reach', async () => {
    expect((await call('kit')).status).toBe(400);
    expect((await call('products', 'p9')).status).toBe(404);
    expect((await call('products', 'p1', 'b9')).status).toBe(404);
  });
});
