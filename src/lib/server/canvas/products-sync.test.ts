import { describe, expect, it, vi, beforeEach } from 'vitest';

const { fetchStoreProductsPage, fetchStoreProduct, classifyStoreUrl, upsertNodeProducts } = vi.hoisted(() => ({
  fetchStoreProductsPage: vi.fn(),
  fetchStoreProduct: vi.fn(),
  classifyStoreUrl: vi.fn(),
  upsertNodeProducts: vi.fn()
}));

vi.mock('$lib/server/store-fetch', () => ({ fetchStoreProductsPage, fetchStoreProduct, classifyStoreUrl }));
vi.mock('$lib/server/repos/products', () => ({ upsertNodeProducts }));

import { syncProductsNode } from './products-sync';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const NODE = '33333333-3333-3333-3333-333333333333';

const STORE_SCOPE = { scope: 'store' as const, platform: null, category: null, handles: [] };

beforeEach(() => {
  vi.clearAllMocks();
  classifyStoreUrl.mockReturnValue(STORE_SCOPE);
});

describe('syncProductsNode — url radice, il catalogo intero come oggi', () => {
  it('quando la pagina fallisce, torna l\'errore letto dal fetcher e non scrive niente', async () => {
    fetchStoreProductsPage.mockResolvedValue({ ok: false, error: 'store_unreachable: /products.json returned 404' });

    const out = await syncProductsNode(null as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      platform: 'shopify',
      storeUrl: 'https://dead-shop.example.com',
      limit: 50,
      after: null,
      onlyFirstPhoto: false
    });

    expect(out).toEqual({ ok: false, error: 'store_unreachable: /products.json returned 404' });
    expect(upsertNodeProducts).not.toHaveBeenCalled();
  });

  it('quando la pagina riesce, scrive col repository e torna quanti, la pagina successiva e cosa ha capito', async () => {
    fetchStoreProductsPage.mockResolvedValue({ ok: true, products: [{ externalId: '1' }, { externalId: '2' }], after: '2' });
    upsertNodeProducts.mockResolvedValue(2);

    const out = await syncProductsNode({} as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      platform: 'shopify',
      storeUrl: 'https://shop.example.com',
      limit: 2,
      after: null,
      onlyFirstPhoto: false
    });

    expect(out).toEqual({ ok: true, synced: 2, after: '2', summary: 'whole store' });
    expect(upsertNodeProducts).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ orgId: ORG, projectId: PROJECT, nodeId: NODE, platform: 'shopify' })
    );
  });

  it('la categoria scritta a mano arriva al fetcher come parametro della pagina', async () => {
    fetchStoreProductsPage.mockResolvedValue({ ok: true, products: [], after: null });
    upsertNodeProducts.mockResolvedValue(0);

    await syncProductsNode({} as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      platform: 'shopify',
      storeUrl: 'https://shop.example.com',
      limit: 2,
      after: null,
      onlyFirstPhoto: false,
      category: 'sale'
    });

    expect(fetchStoreProductsPage).toHaveBeenCalledWith('shopify', 'https://shop.example.com', expect.objectContaining({ category: 'sale' }));
  });
});

describe('syncProductsNode — url di collezione, la categoria si capisce da sola', () => {
  it('imposta la categoria dall\'URL e la passa al fetcher della pagina', async () => {
    classifyStoreUrl.mockReturnValue({ scope: 'collection', platform: 'shopify', category: 'mens-shoes', handles: [] });
    fetchStoreProductsPage.mockResolvedValue({ ok: true, products: [{ externalId: '1' }], after: null });
    upsertNodeProducts.mockResolvedValue(1);

    const out = await syncProductsNode({} as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      platform: 'shopify',
      storeUrl: 'https://allbirds.com/collections/mens-shoes',
      limit: 20,
      after: null,
      onlyFirstPhoto: false
    });

    expect(fetchStoreProductsPage).toHaveBeenCalledWith('shopify', 'https://allbirds.com/collections/mens-shoes', expect.objectContaining({ category: 'mens-shoes' }));
    expect(out).toEqual({ ok: true, synced: 1, after: null, summary: 'collection: mens-shoes' });
  });
});

describe('syncProductsNode — url di un singolo prodotto', () => {
  it('scarica solo quel prodotto e non chiama la pagina del catalogo', async () => {
    classifyStoreUrl.mockReturnValue({ scope: 'products', platform: 'shopify', category: null, handles: ['mens-wool-runners'] });
    fetchStoreProduct.mockResolvedValue({ ok: true, product: { externalId: '1', handle: 'mens-wool-runners' } });
    upsertNodeProducts.mockResolvedValue(1);

    const out = await syncProductsNode({} as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      platform: 'shopify',
      storeUrl: 'https://allbirds.com/products/mens-wool-runners',
      limit: 20,
      after: null,
      onlyFirstPhoto: false
    });

    expect(fetchStoreProductsPage).not.toHaveBeenCalled();
    expect(fetchStoreProduct).toHaveBeenCalledWith('shopify', 'https://allbirds.com/products/mens-wool-runners', 'mens-wool-runners', false);
    expect(out).toEqual({ ok: true, synced: 1, after: null, summary: '1 product' });
  });

  it('più URL di prodotto scaricano ognuno il proprio e sommano il conteggio', async () => {
    classifyStoreUrl.mockReturnValue({ scope: 'products', platform: 'shopify', category: null, handles: ['a', 'b'] });
    fetchStoreProduct
      .mockResolvedValueOnce({ ok: true, product: { externalId: '1', handle: 'a' } })
      .mockResolvedValueOnce({ ok: true, product: { externalId: '2', handle: 'b' } });
    upsertNodeProducts.mockResolvedValue(2);

    const out = await syncProductsNode({} as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      platform: 'shopify',
      storeUrl: 'https://shop.example.com/products/a\nhttps://shop.example.com/products/b',
      limit: 20,
      after: null,
      onlyFirstPhoto: false
    });

    expect(fetchStoreProduct).toHaveBeenCalledTimes(2);
    expect(out).toEqual({ ok: true, synced: 2, after: null, summary: '2 products' });
  });

  it('un handle che fallisce torna l\'errore letto e non scrive niente', async () => {
    classifyStoreUrl.mockReturnValue({ scope: 'products', platform: 'shopify', category: null, handles: ['missing'] });
    fetchStoreProduct.mockResolvedValue({ ok: false, error: 'store_unreachable: /products/missing.json returned 404' });

    const out = await syncProductsNode({} as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      platform: 'shopify',
      storeUrl: 'https://shop.example.com/products/missing',
      limit: 20,
      after: null,
      onlyFirstPhoto: false
    });

    expect(out).toEqual({ ok: false, error: 'store_unreachable: /products/missing.json returned 404' });
    expect(upsertNodeProducts).not.toHaveBeenCalled();
  });
});
