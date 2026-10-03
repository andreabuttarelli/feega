import { describe, expect, it, vi } from 'vitest';
import type { StudioOptions } from './studio-options';

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

const { startPreview } = await import('./studio-batch');

const options: StudioOptions = {
  products: [{ id: 'p1', nodeId: 'n', title: 'Linen shirt', image: null, imageCount: 1, productType: null, tags: [], kids: false, source: { platform: 'shopify', externalId: 'x' } as never }],
  models: [],
  imageModels: [{ id: 'lite', label: 'Lite', credits: 3, maxRefs: 10 }],
  defaultModel: 'lite',
  previewModel: 'lite'
};

describe('a batch canvas opens with its own summary node', () => {
  it('the materialised canvas gets a studio batch node pointing at the batch', async () => {
    const outcome = await startPreview({} as never, { orgId: 'org', projectId: 'proj', userId: 'u' }, { name: 'B', productIds: ['p1'], modelIds: [], environments: ['white_ecom'], shots: ['packshot'], variations: 1, model: 'lite', styleRefs: [], noPeopleConfirmed: false }, options);

    expect(outcome).toEqual({ batchId: 'batch-1' });
    expect(createNode).toHaveBeenCalledWith({}, expect.objectContaining({ canvasId: 'canvas-1', type: 'studio_batch', data: { batchId: 'batch-1' }, displayName: 'B' }));
  });
});
