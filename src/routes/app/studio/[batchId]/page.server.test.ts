import { beforeEach, describe, expect, it, vi } from 'vitest';

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  orgId: 'org',
  batchId: 'batch-1',
  genNodeId: 'cell-1',
  productIndex: 1,
  productTitle: 'Mug',
  influencerId: null,
  environment: 'marble',
  shot: 'packshot',
  variation: 1,
  preview: false,
  model: 'lite',
  status: 'done',
  attempts: 1,
  error: null,
  assetId: `asset-${id}`,
  nodeRunId: null,
  approval: 'approved',
  updatedAt: '',
  ...over
});

const state = vi.hoisted(() => ({ items: [] as unknown[], brand: { id: 'brand-1' } as { id: string } | null }));

vi.mock('$lib/server/dashboard/tool-scope', () => ({
  batchScope: vi.fn(async () => ({ db: {}, orgId: 'org', projectId: 'proj', userId: 'u', batch: { id: 'batch-1', name: 'Mugs' } }))
}));
vi.mock('$lib/server/repos/product-batches', async (original) => ({
  ...(await original<typeof import('$lib/server/repos/product-batches')>()),
  listItems: vi.fn(async () => state.items)
}));
vi.mock('$lib/server/repos/brands', () => ({ findBrand: vi.fn(async () => state.brand), listOrgBrands: vi.fn(async () => []) }));
vi.mock('$lib/server/repos/posts', () => ({ promoteToPost: vi.fn(async () => ({ id: 'post-1' })) }));

const { actions } = await import('./+page.server');
const posts = await import('$lib/server/repos/posts');

function event(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    body.set(k, v);
  }
  return { request: new Request('http://x', { method: 'POST', body }), params: { batchId: 'batch-1' }, locals: {} } as never;
}

describe('batch actions: calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.brand = { id: 'brand-1' };
  });

  it('le foto scelte diventano un post in bozza del brand, nel giorno chiesto, legato alle celle che le hanno generate', async () => {
    state.items = [item('a'), item('b', { approval: 'pending' }), item('c', { genNodeId: 'cell-2' })];
    const out = (await actions.calendar(event({ brand_id: 'brand-1', date: '2026-10-07' }))) as { post: { id: string; href: string } };

    expect(out.post).toEqual({ id: 'post-1', href: '/p/proj/calendar?brand=brand-1&month=2026-10' });
    expect(posts.promoteToPost).toHaveBeenCalledWith({}, expect.objectContaining({
      orgId: 'org',
      brandId: 'brand-1',
      media: [{ assetId: 'asset-a', order: 0, role: 'media' }, { assetId: 'asset-c', order: 1, role: 'media' }],
      sources: [{ nodeId: 'cell-1', role: 'media' }, { nodeId: 'cell-2', role: 'media' }],
      plannedFor: '2026-10-07T09:00:00.000Z'
    }));
  });

  it('senza foto scelte non crea niente e dice cosa fare', async () => {
    state.items = [item('a', { approval: 'pending' })];
    const out = (await actions.calendar(event({ brand_id: 'brand-1', date: '2026-10-07' }))) as { status: number; data: { error: string } };
    expect(out.status).toBe(422);
    expect(out.data.error).toMatch(/pick/i);
    expect(posts.promoteToPost).not.toHaveBeenCalled();
  });

  it('un brand di un’altra org è rifiutato', async () => {
    state.items = [item('a')];
    state.brand = null;
    const out = (await actions.calendar(event({ brand_id: 'x', date: '2026-10-07' }))) as { status: number };
    expect(out.status).toBe(422);
    expect(posts.promoteToPost).not.toHaveBeenCalled();
  });
});
