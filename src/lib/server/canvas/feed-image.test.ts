import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { fakeDb } from '$lib/server/db/fake-db';
import { DropOn } from '$lib/motion/move-element';

const safeFetchBytes = vi.fn();
const placeMedia = vi.fn();

vi.mock('$lib/server/tool-guard', async (importOriginal) => ({ ...(await importOriginal<object>()), safeFetchBytes: (...a: unknown[]) => safeFetchBytes(...a) }));
vi.mock('$lib/server/motion/move-element', async (importOriginal) => ({ ...(await importOriginal<object>()), placeMedia: (...a: unknown[]) => placeMedia(...a) }));

const { importFeedImage } = await import('./feed-image');
const { UploadError } = await import('./upload');

const ORG = 'org-1';
const PROJECT = 'project-1';
const CANVAS = 'canvas-1';
const ACTOR = { kind: 'user', id: 'user-1' } as const;
const FRAMES = {} as never;

const FEED_NODE = { id: 'feed-1', org_id: ORG, canvas_id: CANVAS, project_id: PROJECT, type: 'social_account_feed', x: 0, y: 0, z: 0, data: {}, version: 1 };
const SHOP_NODE = { id: 'shop-1', org_id: ORG, canvas_id: CANVAS, project_id: PROJECT, type: 'products', x: 0, y: 0, z: 0, data: {}, version: 1 };
const TEXT_NODE = { id: 'text-1', org_id: ORG, canvas_id: CANVAS, project_id: PROJECT, type: 'text', x: 0, y: 0, z: 0, data: {}, version: 1 };

const POST = {
  id: 'post-1', org_id: ORG, node_id: 'feed-1', project_id: PROJECT, platform: 'instagram', external_id: 'ig-9', handle: 'atelier', caption: 'New drop', permalink: 'https://instagram.com/p/ig-9',
  media: { type: 'image', thumbnailUrl: 'https://cdn.test/t.jpg', items: [{ type: 'image', url: 'https://cdn.test/full.jpg', thumbnailUrl: 'https://cdn.test/t.jpg' }] },
  metrics: null, posted_at: '2026-10-01T00:00:00Z', fetched_at: '2026-10-02T00:00:00Z'
};

const PRODUCT = {
  id: 'prod-1', org_id: ORG, node_id: 'shop-1', project_id: PROJECT, platform: 'shopify', external_id: 'sh-4', handle: 'linen-shirt', title: 'Linen shirt', description: null, price: 89, currency: 'EUR',
  url: 'https://shop.test/products/linen-shirt', images: [{ url: 'https://shop.test/a.jpg' }, { url: 'https://shop.test/b.jpg' }], available: true, compare_at_price: null, tags: [], vendor: null,
  product_type: null, sku: null, variants: [], options: [], synced_at: '2026-10-02T00:00:00Z', created_at: '2026-10-02T00:00:00Z'
};

const CANVAS_DROP = { on: DropOn.Canvas, x: 1000, y: 500 } as const;

async function png(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#cc3322' } }).png().toBuffer();
}

function world() {
  return fakeDb({ nodes: [FEED_NODE, SHOP_NODE, TEXT_NODE], social_posts: [POST], products: [PRODUCT], assets: [] }, { filter: true, store: true, newId: () => 'new-id' });
}

const ask = (over: Record<string, unknown> = {}) => ({ orgId: ORG, projectId: PROJECT, canvasId: CANVAS, nodeId: 'feed-1', itemId: 'post-1', imageIndex: 0, drop: CANVAS_DROP, ...over });

const insertOf = (calls: { table: string; op: string; payload?: unknown }[], table: string) => calls.find((c) => c.table === table && c.op === 'insert')?.payload as Record<string, unknown> | undefined;

beforeEach(() => {
  safeFetchBytes.mockReset();
  placeMedia.mockReset();
});

describe('dragging a feed or product picture out of its node', () => {
  it('copies a post picture into canvas-assets, registers the asset and creates an image node sized to it', async () => {
    safeFetchBytes.mockResolvedValue({ url: 'https://cdn.test/full.jpg', status: 200, ok: true, mime: 'image/png', bytes: await png(200, 100) });
    const { db, calls } = world();

    const landed = await importFeedImage({ db, frames: FRAMES, actor: ACTOR }, ask());

    expect(safeFetchBytes).toHaveBeenCalledWith('https://cdn.test/full.jpg', expect.objectContaining({ scheme: 'https-only' }));
    const upload = calls.find((c) => c.table === 'storage:canvas-assets' && c.op === 'upload');
    expect(String(upload?.filters[0]?.[1])).toMatch(/^org-1\/project-1\//);
    expect(insertOf(calls, 'assets')).toMatchObject({ org_id: ORG, project_id: PROJECT, type: 'image', width: 200, height: 100 });
    expect(landed).toMatchObject({ placed: 'canvas' });
    const node = insertOf(calls, 'nodes');
    expect(node).toMatchObject({ org_id: ORG, canvas_id: CANVAS, type: 'image', x: 1000 - 180, y: 500 - 90, width: 360, height: 180 });
    expect(node?.data).toMatchObject({
      assetId: 'new-id',
      source: { kind: 'post', nodeId: 'feed-1', itemId: 'post-1', externalId: 'ig-9', imageUrl: 'https://cdn.test/full.jpg', pageUrl: 'https://instagram.com/p/ig-9' }
    });
  });

  it('creates the node under the id the placeholder already has', async () => {
    safeFetchBytes.mockResolvedValue({ url: 'https://cdn.test/full.jpg', status: 200, ok: true, mime: 'image/png', bytes: await png(200, 100) });
    const { db, calls } = world();

    await importFeedImage({ db, frames: FRAMES, actor: ACTOR }, ask({ id: 'placeholder-1' }));

    expect(insertOf(calls, 'nodes')).toMatchObject({ id: 'placeholder-1', actor_kind: 'user', actor_id: 'user-1' });
  });

  it('copies the chosen picture of a product', async () => {
    safeFetchBytes.mockResolvedValue({ url: 'https://shop.test/b.jpg', status: 200, ok: true, mime: 'image/png', bytes: await png(100, 200) });
    const { db, calls } = world();

    await importFeedImage({ db, frames: FRAMES, actor: ACTOR }, ask({ nodeId: 'shop-1', itemId: 'prod-1', imageIndex: 1 }));

    expect(safeFetchBytes).toHaveBeenCalledWith('https://shop.test/b.jpg', expect.anything());
    expect(insertOf(calls, 'nodes')?.data).toMatchObject({ source: { kind: 'product', itemId: 'prod-1', externalId: 'sh-4', imageUrl: 'https://shop.test/b.jpg', pageUrl: 'https://shop.test/products/linen-shirt' } });
    expect(insertOf(calls, 'nodes')).toMatchObject({ width: 180, height: 360 });
  });

  it('puts the picture in the frame under the drop, as the image dropped in a frame does, and makes no node', async () => {
    safeFetchBytes.mockResolvedValue({ url: 'https://cdn.test/full.jpg', status: 200, ok: true, mime: 'image/png', bytes: await png(200, 100) });
    placeMedia.mockResolvedValue({ outcome: 'done', frameId: 'frame-1', clipId: 'clip-1', created: false, versions: { 'frame-1': 2 }, undo: [] });
    const { db, calls } = world();
    const drop = { on: DropOn.Frame, nodeId: 'frame-1', at: { x: 0.25, y: 0.75 } } as const;

    const landed = await importFeedImage({ db, frames: FRAMES, actor: ACTOR }, ask({ drop }));

    expect(placeMedia).toHaveBeenCalledWith(FRAMES, expect.objectContaining({ kind: 'image', assetId: 'new-id', width: 200, height: 100 }), drop);
    expect(insertOf(calls, 'assets')).toBeDefined();
    expect(insertOf(calls, 'nodes')).toBeUndefined();
    expect(landed).toMatchObject({ placed: 'frame', moved: { outcome: 'done', frameId: 'frame-1' } });
  });

  it('refuses a post that is not in that feed and copies nothing', async () => {
    const { db, calls } = world();

    await expect(importFeedImage({ db, frames: FRAMES, actor: ACTOR }, ask({ itemId: 'post-elsewhere' }))).rejects.toBeInstanceOf(UploadError);

    expect(safeFetchBytes).not.toHaveBeenCalled();
    expect(insertOf(calls, 'nodes')).toBeUndefined();
  });

  it('refuses a node that is not a feed or a products node', async () => {
    const { db } = world();

    await expect(importFeedImage({ db, frames: FRAMES, actor: ACTOR }, ask({ nodeId: 'text-1' }))).rejects.toBeInstanceOf(UploadError);
  });

  it('refuses a node of another canvas', async () => {
    const { db } = world();

    await expect(importFeedImage({ db, frames: FRAMES, actor: ACTOR }, ask({ canvasId: 'canvas-2' }))).rejects.toBeInstanceOf(UploadError);
  });

  it('refuses a picture index the item does not have', async () => {
    const { db } = world();

    await expect(importFeedImage({ db, frames: FRAMES, actor: ACTOR }, ask({ imageIndex: 4 }))).rejects.toBeInstanceOf(UploadError);
    expect(safeFetchBytes).not.toHaveBeenCalled();
  });

  it('leaves no node and no asset when the picture cannot be fetched', async () => {
    safeFetchBytes.mockResolvedValue({ url: 'https://cdn.test/full.jpg', status: 403, ok: false, mime: 'text/html', bytes: Buffer.from('') });
    const { db, calls } = world();

    await expect(importFeedImage({ db, frames: FRAMES, actor: ACTOR }, ask())).rejects.toBeInstanceOf(UploadError);

    expect(insertOf(calls, 'assets')).toBeUndefined();
    expect(insertOf(calls, 'nodes')).toBeUndefined();
  });
});
