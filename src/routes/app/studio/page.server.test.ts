import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioOptions } from '$lib/server/studio/studio-options';

const options: StudioOptions = {
  products: [
    { id: 'p1', nodeId: 'n', title: 'Linen shirt', image: null, imageCount: 1, productType: null, tags: [], kids: false, source: { origin: 'store', product: { platform: 'shopify', externalId: 'e1' } } as never },
    { id: 'p2', nodeId: 'n', title: 'Baby onesie', image: null, imageCount: 1, productType: null, tags: ['baby'], kids: true, source: { origin: 'store', product: { platform: 'shopify', externalId: 'e2' } } as never }
  ],
  models: [
    { id: 'synthetic', name: 'Ava', age: 25, cover: null, viewCount: 3, allowed: true, why: '' },
    { id: 'talent', name: 'Real', age: 30, cover: null, viewCount: 3, allowed: false, why: 'Catalogue talents are real people' }
  ],
  imageModels: [
    { id: 'pro', label: 'Pro', credits: 14, maxRefs: 5 },
    { id: 'lite', label: 'Lite', credits: 3, maxRefs: 10 }
  ],
  defaultModel: 'pro',
  previewModel: 'lite'
};

const balance = vi.hoisted(() => ({ value: 5 }));
const gate = vi.hoisted(() => ({ denied: undefined as undefined | { status: number; data: { error: string; message: string } } }));

vi.mock('$lib/server/dashboard/tool-scope', () => ({
  toolScope: vi.fn(async () => ({ db: {}, orgId: 'org', projectId: 'proj', userId: 'u' }))
}));
vi.mock('$lib/server/studio/studio-options', async (original) => ({
  ...(await original<typeof import('$lib/server/studio/studio-options')>()),
  studioOptions: vi.fn(async () => options)
}));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiActionForForm: vi.fn(async () => gate.denied) }));
vi.mock('$lib/server/credits', () => ({ orgCreditBalance: vi.fn(async () => balance.value) }));
const uploads = vi.hoisted(() => ({ node: null as null | { id: string; type: string; data: Record<string, unknown> } }));

vi.mock('$lib/server/repos/canvas', async (original) => ({
  ...(await original<typeof import('$lib/server/repos/canvas')>()),
  listCanvases: vi.fn(async () => (uploads.node ? [{ id: 'studio-canvas', name: 'Photo studio' }] : [])),
  listNodes: vi.fn(async () => (uploads.node ? [uploads.node] : [])),
  createCanvas: vi.fn(async () => ({ id: 'canvas' })),
  createNode: vi.fn(async (_db: unknown, input: { type: string }) => ({ id: `node-${input.type}` })),
  createConnection: vi.fn(async () => ({})),
  patchNodeData: vi.fn(async () => ({ outcome: 'written' }))
}));
vi.mock('$lib/server/repos/products', () => ({
  upsertNodeProducts: vi.fn(async () => 1),
  listNodeProducts: vi.fn(async () => [])
}));
vi.mock('$lib/server/repos/assets', () => ({
  insertAsset: vi.fn(async () => ({ id: 'asset-1' })),
  deleteAsset: vi.fn()
}));
vi.mock('$lib/server/studio/studio-media', () => ({
  signedAssets: vi.fn(async (_db: unknown, _org: string, ids: string[]) => ({ assets: new Map(), urls: Object.fromEntries(ids.map((id) => [id, `https://signed/${id}`])) }))
}));
vi.mock('$lib/server/repos/product-batches', async (original) => ({
  ...(await original<typeof import('$lib/server/repos/product-batches')>()),
  insertBatch: vi.fn(async (_db: unknown, input: Record<string, unknown>) => ({ ...input, id: 'batch-1', canvasId: null, productsNodeId: null, status: 'draft' })),
  updateBatch: vi.fn(async () => undefined),
  insertItems: vi.fn(async (_db: unknown, items: unknown[]) => items),
  listBatches: vi.fn(async () => [])
}));

const { actions } = await import('./+page.server');
const batches = await import('$lib/server/repos/product-batches');
const canvas = await import('$lib/server/repos/canvas');

function event(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    body.set(k, v);
  }
  return { request: new Request('http://x', { method: 'POST', body }), params: {}, url: new URL('http://x/app/studio?project=proj'), locals: {} } as never;
}

const selection = (s: unknown) => event({ selection: JSON.stringify(s) });

const base = { name: 'B', productIds: ['p1', 'p2'], modelIds: ['synthetic'], environments: ['white_ecom'], shots: ['packshot', 'on_model_front'], variations: 1, model: 'pro' };

describe('studio actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    balance.value = 5;
    gate.denied = undefined;
  });

  it('quote: conta, prezza e spiega cosa salta', async () => {
    const out = (await actions.quote(selection(base))) as { quote: { count: number; total: number; skipped: string[] } };
    expect(out.quote.count).toBe(3);
    expect(out.quote.total).toBe(42);
    expect(out.quote.skipped).toEqual(["Baby onesie · On-model front: kids' product: packshot and detail only"]);
  });

  it('quote: rifiuta un talento reale del catalogo', async () => {
    const out = (await actions.quote(selection({ ...base, modelIds: ['talent'] }))) as { status: number; data: { error: string } };
    expect(out.status).toBe(422);
    expect(out.data.error).toMatch(/real people/);
  });

  it('quote: i riferimenti di stile esigono la conferma «nessuna persona»', async () => {
    const refs = [{ source: 'catalogue', id: 'c1' }];
    const refused = (await actions.quote(selection({ ...base, styleRefs: refs }))) as { status: number };
    expect(refused.status).toBe(422);
    const ok = (await actions.quote(selection({ ...base, styleRefs: refs, noPeopleConfirmed: true }))) as { quote: { droppedRefs: number } };
    expect(ok.quote.droppedRefs).toBe(0);
  });

  it('generate: crediti insufficienti → 402 con quanto serve e quanto c’è, prima di scrivere qualcosa', async () => {
    const out = (await actions.generate(selection({ ...base, productIds: ['p1'], shots: ['packshot'], variations: 3, model: 'lite' }))) as {
      status: number;
      data: { error: string; shortfall: { needed: number; balance: number } };
    };
    expect(out.status).toBe(402);
    expect(out.data.shortfall).toEqual({ needed: 9, balance: 5 });
    expect(batches.insertBatch).not.toHaveBeenCalled();
  });

  it('generate: il cancello del piano risponde 402 con il suo messaggio', async () => {
    gate.denied = { status: 402, data: { error: 'credits_exhausted', message: 'AI credits are exhausted' } };
    const out = (await actions.generate(selection(base))) as { status: number; data: { error: string; shortfall: null } };
    expect(out.status).toBe(402);
    expect(out.data.error).toMatch(/exhausted/);
  });

  it('generate: accoda tutte le varianti sul modello scelto, non un’anteprima, e porta al lotto', async () => {
    balance.value = 1000;
    const out = await Promise.resolve(actions.generate(selection({ ...base, productIds: ['p1'], shots: ['packshot'], environments: ['white_ecom', 'marble'], variations: 2, model: 'lite' }))).catch((e: unknown) => e);
    expect(out).toMatchObject({ status: 303, location: '/app/studio/batch-1' });
    const items = vi.mocked(batches.insertItems).mock.calls[0][1];
    expect(items).toHaveLength(4);
    expect(items.every((i) => !i.preview && i.model === 'lite')).toBe(true);
    expect(batches.updateBatch).toHaveBeenLastCalledWith({}, expect.objectContaining({ patch: { status: 'running' } }));
  });

  it('upload: la prima foto apre la lista «Photo studio» del progetto e diventa un prodotto da scegliere', async () => {
    uploads.node = null;
    const out = (await actions.upload(
      event({ path: 'org/proj/abc-mug.jpg', file_name: 'mug.jpg', mime_type: 'image/jpeg', bytes: '200000', width: '1600', height: '1600' })
    )) as { product: { id: string; title: string; image: string } };

    expect(out.product).toEqual({ id: 'upload:asset-1', title: 'Mug', image: 'https://signed/asset-1' });
    expect(canvas.createCanvas).toHaveBeenCalledWith({}, expect.objectContaining({ name: 'Photo studio' }));
    const node = vi.mocked(canvas.createNode).mock.calls[0][1];
    expect(node).toMatchObject({ type: 'list', data: { item_kind: 'image', items: [{ asset_id: 'asset-1', label: 'Mug' }], studio_uploads: true } });
  });

  it('upload: le foto successive si aggiungono alla stessa lista', async () => {
    uploads.node = { id: 'uploads', type: 'list', data: { item_kind: 'image', items: [{ asset_id: 'old', label: 'Vase' }], studio_uploads: true } };
    await actions.upload(event({ path: 'org/proj/abc-mug.jpg', file_name: 'mug.jpg', mime_type: 'image/jpeg', bytes: '200000', width: '1600', height: '1600' }));

    expect(canvas.createNode).not.toHaveBeenCalled();
    expect(canvas.patchNodeData).toHaveBeenCalledWith({}, expect.objectContaining({
      nodeId: 'uploads',
      patch: { items: [{ asset_id: 'old', label: 'Vase' }, { asset_id: 'asset-1', label: 'Mug' }] }
    }));
    uploads.node = null;
  });

  it('upload: una foto troppo piccola è rifiutata con il motivo e cosa fare', async () => {
    const out = (await actions.upload(
      event({ path: 'org/proj/abc-mug.jpg', file_name: 'mug.jpg', mime_type: 'image/jpeg', bytes: '20000', width: '200', height: '200' })
    )) as { status: number; data: { error: string } };
    expect(out.status).toBe(422);
    expect(out.data.error).toMatch(/too small.*closer/i);
    expect(canvas.createNode).not.toHaveBeenCalled();
  });

  it('upload: un percorso di un’altra org è rifiutato', async () => {
    const out = (await actions.upload(
      event({ path: 'other/proj/x.jpg', file_name: 'x.jpg', mime_type: 'image/jpeg', bytes: '200000', width: '1600', height: '1600' })
    )) as { status: number };
    expect(out.status).toBe(400);
  });
});
