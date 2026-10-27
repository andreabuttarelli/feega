import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';
import { fakeDb } from '$lib/server/db/fake-db';

const resolveOrgCaller = vi.fn();
const gateOrgAiAction = vi.fn();
const safeFetchBytes = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args) }));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiAction: (...args: unknown[]) => gateOrgAiAction(...args) }));
vi.mock('$lib/server/tool-guard', async (importOriginal) => ({ ...(await importOriginal<object>()), safeFetchBytes: (...a: unknown[]) => safeFetchBytes(...a) }));

import { POST } from './+server';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const USER = '55555555-5555-5555-5555-555555555555';

const projectRow = { id: PROJECT, org_id: ORG, name: 'p', slug: 'p', brand_id: null, archived_at: null, updated_at: '2026-10-01T00:00:00Z', mode: null };
const canvasRow = { id: CANVAS, org_id: ORG, project_id: PROJECT, name: 'One', share_token: null, shared_at: null, deleted_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
const shop = { id: 'shop-1', org_id: ORG, canvas_id: CANVAS, project_id: PROJECT, type: 'products', x: 0, y: 0, z: 0, data: {}, version: 1 };
const product = {
  id: 'prod-1', org_id: ORG, node_id: 'shop-1', project_id: PROJECT, platform: 'shopify', external_id: 'sh-4', handle: 'linen-shirt', title: 'Linen shirt', description: null, price: 89, currency: 'EUR',
  url: 'https://shop.test/products/linen-shirt', images: [{ url: 'https://shop.test/a.jpg' }], available: true, compare_at_price: null, tags: [], vendor: null, product_type: null, sku: null,
  variants: [], options: [], synced_at: '2026-10-02T00:00:00Z', created_at: '2026-10-02T00:00:00Z'
};

function seed() {
  const faked = fakeDb({ projects: [projectRow], canvases: [canvasRow], nodes: [shop], products: [product], assets: [] }, { filter: true, store: true, newId: () => 'new-id' });
  resolveOrgCaller.mockResolvedValue({ caller: { db: faked.db, orgId: ORG, userId: USER, writeAllowed: true, apiKeyId: 'key-1' } });
  return faked;
}

async function call(op: string, input: Record<string, unknown>) {
  const url = new URL('https://feega.test/api/v1/org/canvas');
  const res = await (POST as (event: unknown) => Promise<Response>)({
    request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ project_id: PROJECT, op, input }) }),
    url
  });
  return { status: res.status, body: await res.json() };
}

beforeEach(async () => {
  vi.clearAllMocks();
  gateOrgAiAction.mockResolvedValue(undefined);
  const bytes = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#ffffff' } }).png().toBuffer();
  safeFetchBytes.mockResolvedValue({ url: 'https://shop.test/a.jpg', status: 200, ok: true, mime: 'image/png', bytes });
});

describe('an agent pulls a product picture out of a products node', () => {
  it('copies it into storage and creates the asset and an image node at the point, with its provenance', async () => {
    const { calls } = seed();

    const { status, body } = await call('import_feed_image', { canvasId: CANVAS, nodeId: 'shop-1', itemId: 'prod-1', x: 900, y: 300 });

    expect(status).toBe(200);
    expect(calls.some((c) => c.table === 'storage:canvas-assets' && c.op === 'upload' && String(c.filters[0]?.[1]).startsWith(`${ORG}/${PROJECT}/`))).toBe(true);
    expect(calls.find((c) => c.table === 'assets' && c.op === 'insert')?.payload).toMatchObject({ org_id: ORG, project_id: PROJECT, type: 'image', width: 400, height: 400 });
    expect(calls.find((c) => c.table === 'nodes' && c.op === 'insert')?.payload).toMatchObject({
      type: 'image', canvas_id: CANVAS, x: 720, y: 120, width: 360, height: 360, actor_kind: 'agent',
      data: { source: { kind: 'product', nodeId: 'shop-1', itemId: 'prod-1', imageUrl: 'https://shop.test/a.jpg' } }
    });
    expect(body).toMatchObject({ node: { type: 'image' }, asset: { id: 'new-id' } });
  });

  it('refuses an item the node does not hold', async () => {
    const { calls } = seed();

    const { body } = await call('import_feed_image', { canvasId: CANVAS, nodeId: 'shop-1', itemId: 'missing' });

    expect(body).toMatchObject({ error: 'invalid_upload' });
    expect(calls.some((c) => c.table === 'nodes' && c.op === 'insert')).toBe(false);
  });

  it('refuses a canvas of another project', async () => {
    seed();

    const { body } = await call('import_feed_image', { canvasId: 'elsewhere', nodeId: 'shop-1', itemId: 'prod-1' });

    expect(body).toMatchObject({ error: 'canvas_not_found' });
  });
});
