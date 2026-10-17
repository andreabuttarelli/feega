import { describe, expect, it, vi } from 'vitest';
import { Environment } from '$lib/studio/environments';
import { Shot } from '$lib/studio/shots';

vi.mock('$lib/server/repos/canvas', () => ({ listCanvases: vi.fn(async () => []), listNodes: vi.fn(async () => []) }));
vi.mock('./studio-media', () => ({ signedAssets: vi.fn(async () => ({ urls: {} })) }));
vi.mock('$lib/server/repos/influencers', () => ({
  listInfluencers: vi.fn(async () => [{ id: 'cat-1', name: 'Mia', orgId: null, source: 'catalogue', age: 28 }]),
  listInfluencerViewsByIds: vi.fn(async () => new Map([['cat-1', [{ storagePath: 'catalogue/cat-1/a.jpg' }]]])),
  signInfluencerViewFiles: vi.fn(async () => new Map([['catalogue/cat-1/a.jpg', 'https://cdn.test/a.jpg']]))
}));
vi.mock('$lib/server/canvas-catalogue', () => ({ canvasModelCatalogue: vi.fn(async () => ({ image: { choices: [] } })) }));

const { studioOptions } = await import('./studio-options');
const { quoteSelection } = await import('./studio-batch');

describe('influencer del catalogo nel Photo studio', () => {
  it('è selezionabile e il piano lo accetta', async () => {
    const options = await studioOptions({} as never, { orgId: 'org', projectId: 'proj' });
    expect(options.models.find((m) => m.id === 'cat-1')).toMatchObject({ allowed: true, why: '' });

    const lite = { id: 'lite', label: 'Lite', credits: 3, maxRefs: 10 };
    const shirt = { id: 'p1', nodeId: 'n', title: 'Linen shirt', image: null, imageCount: 1, productType: null, tags: [], kids: false, source: { origin: 'store', product: {} } as never };
    const selection = { name: 'B', productIds: ['p1'], modelIds: ['cat-1'], environments: [Environment.WhiteEcom], shots: [Shot.Packshot], variations: 1, model: 'lite', styleRefs: [], noPeopleConfirmed: false };
    expect(quoteSelection(selection, { ...options, products: [shirt], imageModels: [lite], previewModel: 'lite' })).not.toHaveProperty('error');
  });
});
