import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const { modalitiesOf, imageCatalogue } = vi.hoisted(() => ({
  modalitiesOf: vi.fn(),
  imageCatalogue: { choices: [] as { id: string; uncensored?: boolean }[], recommended: [] as { tier: string; id: string }[], synced: true }
}));
vi.mock('$lib/server/canvas-catalogue', () => {
  const nothing = { choices: [], recommended: [], synced: true };
  return { canvasModelCatalogue: async () => ({ text: nothing, image: imageCatalogue, video: nothing }) };
});
vi.mock('$lib/server/ai-models-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/ai-models-sync')>()),
  modalitiesOf
}));
vi.mock('$lib/server/supabase-admin', () => ({ createAdminClient: () => ({}) }));

const { orgCreditBalance } = vi.hoisted(() => ({ orgCreditBalance: vi.fn() }));
vi.mock('$lib/server/credits', () => ({ orgCreditBalance }));

const { generateImagesWithoutBrand } = vi.hoisted(() => ({ generateImagesWithoutBrand: vi.fn() }));
vi.mock('$lib/server/media-generate', () => ({ generateImagesWithoutBrand }));

const { screenModelInput } = vi.hoisted(() => ({ screenModelInput: vi.fn() }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput }));

import { planLoop, enqueueLoop, drainLoopQueue } from './loop';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const USER = '44444444-4444-4444-4444-444444444444';
const GEN_NODE = '55555555-5555-5555-5555-555555555555';
const PRODUCTS_NODE = '66666666-6666-6666-6666-666666666666';
const INFLUENCER_NODE = '77777777-7777-7777-7777-777777777777';
const INFLUENCER = '88888888-8888-8888-8888-888888888888';

const nodeRow = (id: string, type: string, data: Record<string, unknown>, version = 1) => ({
  id, org_id: ORG, canvas_id: CANVAS, project_id: PROJECT, type, display_name: null,
  x: 0, y: 0, z: 0, width: null, height: null, data, version, deleted_at: null
});

const edge = (id: string, source: string, target: string, mode: 'fixed' | 'iterate') => ({
  id, org_id: ORG, canvas_id: CANVAS, source_node_id: source, target_node_id: target,
  source_handle: null, target_handle: null, mode, deleted_at: null
});

const product = (n: number) => ({
  id: `p${n}`, org_id: ORG, node_id: PRODUCTS_NODE, project_id: PROJECT, platform: 'shopify',
  external_id: `x${n}`, handle: `h${n}`, title: `Product ${n}`, description: null, price: null,
  currency: null, url: null, images: [{ url: `https://cdn.example/p${n}.jpg` }], available: true,
  compare_at_price: null, tags: [], vendor: null, product_type: null, sku: null, variants: [],
  options: [], synced_at: null, created_at: `2026-10-0${n}T00:00:00Z`
});

const view = {
  id: 'v1', influencer_id: INFLUENCER, view_key: 'front', label: 'Front',
  storage_path: 'catalogue/inf/front.png', mime_type: 'image/png', width: 1, height: 1, sort_order: 0
};

beforeEach(() => {
  imageCatalogue.choices = [];
  imageCatalogue.recommended = [];
  orgCreditBalance.mockResolvedValue(100_000);
  screenModelInput.mockReset();
  screenModelInput.mockResolvedValue({ ok: true });
  modalitiesOf.mockReset();
  modalitiesOf.mockResolvedValue({ input: ['text', 'image'], output: ['image'], synced_at: 'now' });
  generateImagesWithoutBrand.mockReset();
  generateImagesWithoutBrand.mockImplementation(async () => ({
    ok: true,
    media: [{ storage_path: 'out.png', mime: 'image/png', width: 1, height: 1 }],
    costUsd: 0.01
  }));
});

describe('loop over a products node with an influencer wired fixed', () => {
  it('three products: three runs, each with its product image and the influencer view', async () => {
    const { db } = fakeDb(
      {
        nodes: [
          nodeRow(GEN_NODE, 'image', { prompt: 'the influencer wearing the product', model: 'qwen3-pro' }, 5),
          nodeRow(PRODUCTS_NODE, 'products', { platform: 'shopify' }),
          nodeRow(INFLUENCER_NODE, 'influencer', { influencer_id: INFLUENCER })
        ],
        nodes_connections: [edge('e1', PRODUCTS_NODE, GEN_NODE, 'iterate'), edge('e2', INFLUENCER_NODE, GEN_NODE, 'fixed')],
        products: [product(1), product(2), product(3)],
        influencer_views: [view],
        assets: [],
        node_runs: []
      },
      { filter: true, store: true, mutate: true }
    );

    const plan = await planLoop(db, { orgId: ORG, canvasId: CANVAS, nodeId: GEN_NODE });
    expect(plan.combinations).toHaveLength(3);

    const out = await enqueueLoop(db, { orgId: ORG, projectId: PROJECT, canvasId: CANVAS, nodeId: GEN_NODE, userId: USER });
    expect(out.kind).toBe('enqueued');

    await drainLoopQueue(db, { limit: 10 });

    expect(generateImagesWithoutBrand).toHaveBeenCalledTimes(3);
    const sent = generateImagesWithoutBrand.mock.calls.map(([, job]) => JSON.stringify(job));
    for (const [i, job] of sent.entries()) {
      expect(job).toContain(`p${i + 1}.jpg`);
      expect(job).toContain('front.png');
    }
  });

  it('a node without a model loops on a model its standard project allows, never the uncensored recommendation', async () => {
    imageCatalogue.choices = [{ id: 'wiro/uncensored-image', uncensored: true }, { id: 'nano-banana-2-lite' }];
    imageCatalogue.recommended = [{ tier: 'balanced', id: 'wiro/uncensored-image' }, { tier: 'cheapest', id: 'nano-banana-2-lite' }];
    const { db } = fakeDb(
      {
        projects: [{ id: PROJECT, org_id: ORG, mode: 'standard' }],
        nodes: [
          nodeRow(GEN_NODE, 'image', { prompt: 'the influencer wearing the product' }, 5),
          nodeRow(PRODUCTS_NODE, 'products', { platform: 'shopify' }),
          nodeRow(INFLUENCER_NODE, 'influencer', { influencer_id: INFLUENCER })
        ],
        nodes_connections: [edge('e1', PRODUCTS_NODE, GEN_NODE, 'iterate'), edge('e2', INFLUENCER_NODE, GEN_NODE, 'fixed')],
        products: [product(1), product(2), product(3)],
        influencer_views: [view],
        assets: [],
        node_runs: []
      },
      { filter: true, store: true, mutate: true }
    );

    await enqueueLoop(db, { orgId: ORG, projectId: PROJECT, canvasId: CANVAS, nodeId: GEN_NODE, userId: USER });
    const drained = await drainLoopQueue(db, { limit: 10 });

    expect(drained).toEqual({ claimed: 3, done: 3, failed: 0 });
    expect(generateImagesWithoutBrand.mock.calls.map(([, job]) => job.model)).toEqual(['nano-banana-2-lite', 'nano-banana-2-lite', 'nano-banana-2-lite']);
  });
});
