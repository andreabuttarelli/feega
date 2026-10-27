import { describe, expect, it, vi } from 'vitest';
import { json } from '@sveltejs/kit';
import { fakeDb } from '$lib/server/db/fake-db';

const { db } = fakeDb(
  {
    products: [{ id: 'pr1', org_id: 'org-1', brand_id: 'b1', title: 'Cold brew', price: null, currency: null, images: [] }]
  },
  { filter: true }
);

vi.mock('$lib/server/cli-auth', () => ({
  authenticate: async (request: Request) =>
    request.headers.get('authorization') ? { supabase: db, apiKey: null, error: null } : { error: json({ error: 'unauthorized' }, { status: 401 }) },
  loadBrandForUser: async (_db: unknown, slug: string) =>
    slug === 'acme' ? { brand: { id: 'b1', org_id: 'org-1', name: 'Acme', slug } } : { error: json({ error: 'Brand not found' }, { status: 404 }) }
}));

const { GET } = await import('./+server');

const call = (slug: string, tab: string, auth = true) =>
  GET({
    params: { slug },
    url: new URL(`http://x/?tab=${tab}`),
    request: new Request('http://x', { headers: auth ? { authorization: 'Bearer t' } : {} })
  } as never);

describe('GET /api/v1/brands/[slug]/library', () => {
  it('serves the same library the canvas panel reads', async () => {
    const res = await call('acme', 'products');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [{ id: 'pr1', title: 'Cold brew', subtitle: null, assetId: null, mediaType: null }] });
  });

  it('400 for an unknown tab, 404 for a foreign brand, 401 without a token', async () => {
    expect((await call('acme', 'kit')).status).toBe(400);
    expect((await call('other', 'products')).status).toBe(404);
    expect((await call('acme', 'products', false)).status).toBe(401);
  });
});
