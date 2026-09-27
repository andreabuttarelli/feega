import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

vi.mock('$lib/server/brand-colour-asset', () => ({
  findOrCreateColourAsset: vi.fn(async (_db: unknown, input: { hex: string }) => ({
    asset: { id: `swatch-${input.hex}` },
    url: `https://public.example/${input.hex}.png`
  }))
}));

const { loadBrandDetails } = await import('./brand-details');

const ORG = 'org-1';
const BRAND = 'brand-1';

const rows = {
  brands: [{ id: BRAND, org_id: ORG, website: 'https://acme.example', content: 'Palette #112233\n\n- instagram:@acme\n- tiktok:@acme' }],
  social_accounts: [
    { id: 's1', org_id: ORG, brand_id: BRAND, platform: 'instagram', handle: 'Acme', display_name: null, avatar_url: null, status: 'active' },
    { id: 's2', org_id: ORG, brand_id: BRAND, platform: 'x', handle: null, display_name: null, avatar_url: null, status: 'active' }
  ],
  products: [
    { org_id: ORG, brand_id: BRAND, platform: 'shopify', store_url: 'https://acme.myshopify.com' },
    { org_id: ORG, brand_id: BRAND, platform: 'shopify', store_url: 'https://acme.myshopify.com' },
    { org_id: ORG, brand_id: BRAND, platform: 'manual', store_url: null }
  ]
};

describe('loadBrandDetails', () => {
  it('ogni lettura è scopata su org e brand', async () => {
    const { db, calls } = fakeDb(rows);

    await loadBrandDetails(db, { orgId: ORG, brandId: BRAND });

    for (const table of ['brands', 'social_accounts', 'products']) {
      const call = calls.find((c) => c.table === table && c.op === 'select');
      expect(Object.fromEntries(call!.filters)).toMatchObject({ org_id: ORG });
    }
  });

  it('riunisce handle collegati e scritti nel content, senza doppioni', async () => {
    const { db } = fakeDb(rows, { filter: true });

    const details = await loadBrandDetails(db, { orgId: ORG, brandId: BRAND });

    expect(details?.handles).toEqual([
      { platform: 'instagram', handle: 'Acme' },
      { platform: 'tiktok', handle: 'acme' }
    ]);
  });

  it('uno store per catalogo, i colori con lo swatch pronto, il sito', async () => {
    const { db } = fakeDb(rows, { filter: true });

    const details = await loadBrandDetails(db, { orgId: ORG, brandId: BRAND });

    expect(details?.stores).toEqual([{ platform: 'shopify', url: 'https://acme.myshopify.com' }]);
    expect(details?.colours).toEqual([{ hex: '#112233', assetId: 'swatch-#112233', url: 'https://public.example/#112233.png' }]);
    expect(details?.website).toBe('https://acme.example');
  });

  it('un brand di un altra org non esiste', async () => {
    const { db } = fakeDb(rows, { filter: true });
    expect(await loadBrandDetails(db, { orgId: 'org-2', brandId: BRAND })).toBeNull();
  });
});
