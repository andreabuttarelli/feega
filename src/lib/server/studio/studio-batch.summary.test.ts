import { describe, expect, it, vi } from 'vitest';
import type { StudioOptions } from './studio-options';
import { Environment } from '$lib/studio/environments';
import { Shot } from '$lib/studio/shots';

const createNode = vi.fn(async (_db: unknown, input: { type: string }) => ({ id: `node-${input.type}` }));
vi.mock('$lib/server/repos/canvas', () => ({
  createCanvas: vi.fn(async () => ({ id: 'canvas-1' })),
  createNode,
  createConnection: vi.fn(async () => ({}))
}));
vi.mock('$lib/server/repos/products', () => ({ listNodeProducts: vi.fn(async () => []), upsertNodeProducts: vi.fn(async () => undefined) }));
vi.mock('$lib/server/credits', () => ({ orgCreditBalance: vi.fn(async () => 1000) }));
vi.mock('$lib/server/repos/product-batches', async (original) => ({
  ...(await original<object>()),
  insertBatch: vi.fn(async () => ({ id: 'batch-1', spec: { styleRefs: [], cells: {}, modelNodes: {}, droppedRefs: 0 } })),
  updateBatch: vi.fn(async () => undefined),
  insertItems: vi.fn(async () => [])
}));

const { startBatch } = await import('./studio-batch');

const options: StudioOptions = {
  products: [{ id: 'p1', nodeId: 'n', title: 'Linen shirt', image: null, imageCount: 1, productType: null, tags: [], kids: false, source: { origin: 'store', product: { platform: 'shopify', externalId: 'x' } } as never }],
  models: [],
  imageModels: [{ id: 'lite', label: 'Lite', credits: 3, maxRefs: 10 }],
  defaultModel: 'lite',
  previewModel: 'lite'
};

describe('a batch canvas opens with its own summary node', () => {
  it('the materialised canvas gets a studio batch node pointing at the batch', async () => {
    const outcome = await startBatch({} as never, { orgId: 'org', projectId: 'proj', userId: 'u' }, { name: 'B', productIds: ['p1'], modelIds: [], environments: [Environment.WhiteEcom], shots: [Shot.Packshot], variations: 1, model: 'lite', styleRefs: [], noPeopleConfirmed: false }, options);

    expect(outcome).toEqual({ batchId: 'batch-1' });
    expect(createNode).toHaveBeenCalledWith({}, expect.objectContaining({ canvasId: 'canvas-1', type: 'studio_batch', data: { batchId: 'batch-1' }, displayName: 'B' }));
  });

  it('an uploaded photo feeds the cells from an image list, signed at run time, not from a store products node', async () => {
    createNode.mockClear();
    const uploaded = { ...options, products: [{ ...options.products[0], id: 'upload:asset-1', title: 'Mug', source: { origin: 'upload', assetId: 'asset-1' } as never }] };
    await startBatch({} as never, { orgId: 'org', projectId: 'proj', userId: 'u' }, { name: 'B', productIds: ['upload:asset-1'], modelIds: [], environments: [Environment.WhiteEcom], shots: [Shot.Packshot], variations: 1, model: 'lite', styleRefs: [], noPeopleConfirmed: false }, uploaded);

    const types = createNode.mock.calls.map((c) => (c[1] as { type: string }).type);
    expect(types).not.toContain('products');
    const list = createNode.mock.calls.map((c) => c[1] as { type: string; data: Record<string, unknown> }).find((n) => n.type === 'list');
    expect(list?.data).toEqual({ item_kind: 'image', items: [{ label: 'Mug', asset_id: 'asset-1' }], studio_batch_id: 'batch-1' });
  });
});
