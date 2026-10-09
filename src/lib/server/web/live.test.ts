import { describe, expect, it, vi } from 'vitest';

const M = vi.hoisted(() => ({ logAiCall: vi.fn(), port: vi.fn() }));
vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: { EXA_API_KEY: 'k' } }));
vi.mock('$lib/server/ai-log', () => ({ logAiCall: M.logAiCall }));
vi.mock('./search', async (importOriginal) => ({ ...(await importOriginal<typeof import('./search')>()), exaSearch: () => M.port }));

import { loggedSearch, pinterestPort, productImport, screenedImport } from './live';
import { SearchEngine } from './search';

const SCOPE = { orgId: 'org-1', userId: 'u-1', projectId: 'p-1', brandId: null };

describe('web search billing', () => {
  it('logs every search in ai_calls with the provider cost, on the org and project', async () => {
    M.port.mockResolvedValueOnce({ ok: true, results: [], costUsd: 0.007 });

    await loggedSearch(SCOPE, SearchEngine.Exa)('stripe colours', 5);

    expect(M.logAiCall).toHaveBeenCalledWith(expect.objectContaining({ label: 'web-search', provider: 'exa', ok: true, flatCostUsd: 0.007, orgId: 'org-1', projectId: 'p-1', userId: 'u-1', actorKind: 'agent' }));
  });

  it('logs a failed search without a cost', async () => {
    M.logAiCall.mockClear();
    M.port.mockResolvedValueOnce({ ok: false, error: 'web search failed: down' });

    await loggedSearch(SCOPE, SearchEngine.Exa)('q', 5);

    const entry = M.logAiCall.mock.calls[0][0];
    expect(entry).toMatchObject({ ok: false, error: 'web search failed: down' });
    expect(entry.flatCostUsd).toBeUndefined();
  });
});

describe('import_products', () => {
  const product = (handle: string, images: string[]) => ({ handle, title: handle.toUpperCase(), images: images.map((url) => ({ url })) }) as never;

  it('saves the first pictures of each product and places them on the canvas', async () => {
    const save = vi.fn(async (url: string) => (url.includes('bad') ? { ok: false as const, error: 'refused' } : { ok: true as const, assetId: `asset:${url.slice(-1)}`, width: null, height: null }));
    const place = vi.fn(async () => 'node-1');
    const fetchProducts = vi.fn(async () => ({ ok: true as const, platform: 'shopify' as const, products: [product('a', ['https/1', 'https/2', 'https/3']), product('b', ['https/bad'])], missing: ['c'] }));

    const out = await productImport(save, place, fetchProducts)('https://shop.example', ['a', 'b', 'c']);

    expect(out).toEqual({ ok: true, products: [{ handle: 'a', title: 'A', asset_ids: ['asset:1', 'asset:2'] }, { handle: 'b', title: 'B', asset_ids: [] }], missing: ['c'], node_id: 'node-1' });
    expect(place).toHaveBeenCalledWith('shopify', 'https://shop.example', expect.any(Array));
  });

  it('says so when the site is not a store', async () => {
    const out = await productImport(vi.fn(), undefined, async () => ({ ok: false as const, error: 'not a Shopify or WooCommerce store' }))('https://x.example', ['a']);

    expect(out).toEqual({ ok: false, error: 'not a Shopify or WooCommerce store' });
  });
});

describe('motion product pictures', () => {
  it('are screened like uploads before they become video assets', async () => {
    const asset = { id: 'm1' } as never;
    const importAsset = vi.fn(async () => ({ ok: true as const, asset, width: 1, height: 1 }));
    const assets: unknown[] = [];
    const save = screenedImport(importAsset, async (url) => (url.includes('nsfw') ? { ok: false, error: 'refused by the safety review' } : { ok: true }) as never, assets as never);

    expect(await save('https://x/nsfw.png')).toEqual({ ok: false, error: 'refused by the safety review' });
    expect(importAsset).not.toHaveBeenCalled();
    expect(await save('https://x/ok.png')).toEqual({ ok: true, assetId: 'm1', width: 1, height: 1 });
    expect(assets).toEqual([asset]);
  });
});


describe('pinterest billing', () => {
  it('prices every ScrapeCreators request a Pinterest read made, failed ones included', async () => {
    const get = vi.fn().mockResolvedValueOnce({ pins: [{ id: '1' }], cursor: 'c' }).mockRejectedValueOnce(new Error('scrapecreators 500'));

    const found = await pinterestPort(get).search('glass', 20);

    expect(found).toMatchObject({ ok: false, requests: 2, costUsd: 0.004 });
  });
});
