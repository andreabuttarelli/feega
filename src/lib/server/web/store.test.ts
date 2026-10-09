import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const M = vi.hoisted(() => ({ routes: new Map<string, { status: number; type: string; body: string; headers?: Record<string, string> }>() }));
vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$lib/server/tool-guard', () => ({
  SafeFetchError: class extends Error {},
  safeFetchUrl: vi.fn(async (url: string) => {
    const hit = [...M.routes.entries()].find(([prefix]) => url.startsWith(prefix))?.[1] ?? { status: 404, type: 'text/html', body: 'not found' };
    return { url, status: hit.status, ok: hit.status < 400, headers: new Headers({ 'content-type': hit.type, ...hit.headers }), body: hit.body };
  })
}));

import { StoreKind, detectStore, readStore } from './store';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const html = (body: string, headers?: Record<string, string>) => ({ status: 200, type: 'text/html', body, headers });
const json = (body: string) => ({ status: 200, type: 'application/json', body });

beforeEach(() => M.routes.clear());

describe('store detection', () => {
  it.each([
    ['a Shopify theme in the page', html('<script>Shopify.theme = {}</script>'), StoreKind.Shopify],
    ['the Shopify powered-by header', html('<html></html>', { 'powered-by': 'Shopify' }), StoreKind.Shopify],
    ['WooCommerce body classes', html('<body class="home woocommerce-page">'), StoreKind.WooCommerce],
    ['the WooCommerce generator meta', html('<meta name="generator" content="WooCommerce 9.1">'), StoreKind.WooCommerce],
    ['a plain site', html('<h1>Studio</h1>'), StoreKind.None]
  ])('reads %s', async (_label, home, kind) => {
    M.routes.set('https://shop.example/', home);

    expect(await detectStore('https://shop.example/')).toBe(kind);
  });

  it('probes the public endpoints when the page says nothing', async () => {
    M.routes.set('https://shop.example/products.json', json(fixture('shopify-products.json')));
    M.routes.set('https://shop.example/', html('<h1>Shop</h1>'));
    expect(await detectStore('https://shop.example/')).toBe(StoreKind.Shopify);

    M.routes.clear();
    M.routes.set('https://woo.example/wp-json/wc/store/v1/products', json(fixture('woo-products.json')));
    M.routes.set('https://woo.example/', html('<h1>Shop</h1>'));
    expect(await detectStore('https://woo.example/')).toBe(StoreKind.WooCommerce);
  });
});

describe('read_store', () => {
  it('lists Shopify products in one shape: price, compare-at, images, options, tags', async () => {
    M.routes.set('https://shop.example/products.json', json(fixture('shopify-products.json')));
    M.routes.set('https://shop.example/', html('<script>Shopify.theme = {}</script>'));

    const out = await readStore('https://shop.example/');

    expect(out).toMatchObject({ ok: true, platform: StoreKind.Shopify, store: 'https://shop.example' });
    const first = (out as { products: Record<string, unknown>[] }).products[0];
    expect(first).toMatchObject({
      title: "Women's Allbirds Flip Flop - Dusty Pink",
      handle: 'womens-allbirds-flip-flop-dusty-pink',
      url: 'https://shop.example/products/womens-allbirds-flip-flop-dusty-pink',
      price: 25,
      compare_at_price: 50,
      product_type: 'Shoes'
    });
    expect((first.images as string[])[0]).toMatch(/^https:\/\/cdn\.shopify\.com\//);
    expect(first.options).toMatchObject({ Size: expect.any(Array) });
    expect(typeof first.description).toBe('string');
  });

  it('lists WooCommerce products with currency, categories and availability', async () => {
    M.routes.set('https://woo.example/wp-json/wc/store/v1/products', json(fixture('woo-products.json')));
    M.routes.set('https://woo.example/', html('<body class="woocommerce">'));

    const out = await readStore('https://woo.example/');

    expect(out).toMatchObject({ ok: true, platform: StoreKind.WooCommerce });
    expect((out as { products: Record<string, unknown>[] }).products[0]).toMatchObject({
      title: 'QR Code by QodeVault',
      url: 'https://woocommerce.com/products/qr-code-by-qodevault/',
      price: 49,
      currency: 'USD',
      available: true,
      tags: expect.arrayContaining(['WooCommerce extensions'])
    });
  });

  it('says a site that is not a store has no products', async () => {
    M.routes.set('https://studio.example/', html('<h1>Studio</h1>'));

    expect(await readStore('https://studio.example/')).toEqual({ ok: true, platform: StoreKind.None, store: 'https://studio.example', products: [], truncated: false });
  });

  it('refuses what is not a web address', async () => {
    expect(await readStore('file:///etc/passwd')).toMatchObject({ ok: false });
  });
});
