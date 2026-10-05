import { describe, it, expect } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { readBrand } from './brand-brief';

const BRANDS = [
  { id: 'b1', org_id: 'org1', name: 'Verde', slug: 'verde', website: 'https://verde.example', short_description: 'Wool sneakers', logo_url: 'https://cdn.example/verde.svg', content: 'Voice: calm, plain. Colours #1A6B4F and #F2C14E. Titles in Playfair Display, body in Inter.' },
  { id: 'b2', org_id: 'org1', name: 'Rosso Café', slug: 'rosso', website: null, short_description: null, logo_url: null, content: null }
];
const PRODUCTS = [{ org_id: 'org1', brand_id: 'b1', title: 'Runner', price: 120, currency: 'EUR', url: 'https://verde.example/runner', images: [{ url: 'https://cdn.example/runner.jpg' }] }];

function fakeDb(): Db {
  const table = (rows: Record<string, unknown>[]) => {
    let picked = rows;
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        picked = picked.filter((r) => r[column] === value);
        return query;
      },
      order: () => query,
      limit: () => query,
      maybeSingle: async () => ({ data: picked[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: picked, error: null })
    };
    return query;
  };
  return { from: (name: string) => table(name === 'brands' ? BRANDS : PRODUCTS) } as unknown as Db;
}

describe('readBrand: a brand of the org as plain data for the motion agent', () => {
  it('reads the project brand: logo, palette, fonts, voice and products', async () => {
    const out = await readBrand(fakeDb(), { orgId: 'org1', brandId: 'b1' });

    expect(out).toMatchObject({
      ok: true,
      brand: {
        name: 'Verde',
        website: 'https://verde.example',
        logoUrl: 'https://cdn.example/verde.svg',
        palette: ['#1A6B4F', '#F2C14E'],
        fonts: ['Playfair Display', 'Inter'],
        voice: expect.stringContaining('calm, plain'),
        products: [{ name: 'Runner', price: '120 EUR', url: 'https://verde.example/runner', image: 'https://cdn.example/runner.jpg' }]
      }
    });
  });

  it('finds a brand the user names, ignoring case', async () => {
    const out = await readBrand(fakeDb(), { orgId: 'org1', brandId: null }, 'rosso café');

    expect(out).toMatchObject({ ok: true, brand: { name: 'Rosso Café' } });
  });

  it('without a project brand or a name, lists the brands it can use', async () => {
    const out = await readBrand(fakeDb(), { orgId: 'org1', brandId: null });

    expect(out).toEqual({ ok: false, error: expect.stringContaining('Verde, Rosso Café') });
  });

  it('never reads a brand of another org', async () => {
    const out = await readBrand(fakeDb(), { orgId: 'org2', brandId: 'b1' });

    expect(out.ok).toBe(false);
  });
});
