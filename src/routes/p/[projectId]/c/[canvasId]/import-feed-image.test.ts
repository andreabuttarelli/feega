import { beforeEach, describe, expect, it, vi } from 'vitest';

const gateOrgAiActionForForm = vi.fn();
const listMemberships = vi.fn();
const findCanvasForUser = vi.fn();
const runGenNode = vi.fn();
const safeFetchBytes = vi.fn();

vi.mock('$lib/server/cli-auth', () => ({
	gateOrgAiActionForForm: (...a: unknown[]) => gateOrgAiActionForForm(...a)
}));
vi.mock('$lib/server/repos/orgs', () => ({
	listMemberships: (...a: unknown[]) => listMemberships(...a)
}));
vi.mock('$lib/server/canvas/lookup', () => ({
	findCanvasForUser: (...a: unknown[]) => findCanvasForUser(...a)
}));
vi.mock('$lib/server/canvas/generate', () => ({
	runGenNode: (...a: unknown[]) => runGenNode(...a),
	runsOf: vi.fn()
}));
vi.mock('$lib/server/tool-guard', async (importOriginal) => ({ ...(await importOriginal<object>()), safeFetchBytes: (...a: unknown[]) => safeFetchBytes(...a) }));
vi.mock('$lib/server/canvas/loop', () => ({ planLoop: vi.fn(), runLoop: vi.fn() }));
vi.mock('$lib/server/canvas/duplicate', () => ({ duplicateNodes: vi.fn() }));
vi.mock('$lib/server/canvas/undo', () => ({ undoGesture: vi.fn() }));
vi.mock('$lib/server/canvas/products-sync', () => ({ syncProductsNode: vi.fn() }));
vi.mock('$lib/server/canvas/social-feed-sync', () => ({ syncSocialFeedNode: vi.fn() }));
vi.mock('$lib/canvas/doc-node', async (importOriginal) => ({ ...(await importOriginal<object>()), mintShareToken: vi.fn() }));
vi.mock('$lib/server/repos/doc-share', () => ({ clearDocShare: vi.fn(), setDocShare: vi.fn() }));
vi.mock('$lib/server/canvas-catalogue', () => ({ canvasModelCatalogue: vi.fn() }));
vi.mock('$lib/server/repos/influencers', () => ({
	getInfluencer: vi.fn(),
	listInfluencerViewsByIds: vi.fn(),
	signInfluencerViewFiles: vi.fn()
}));

import sharp from 'sharp';
import { fakeDb } from '$lib/server/db/fake-db';
import { actions } from './+page.server';

const ORG = 'org-1';
const FEED = { id: 'feed-1', org_id: ORG, canvas_id: 'canvas-1', project_id: 'project-1', type: 'social_account_feed', x: 0, y: 0, z: 0, data: {}, version: 1 };
const SHOP = { id: 'shop-1', org_id: ORG, canvas_id: 'canvas-1', project_id: 'project-1', type: 'products', x: 0, y: 0, z: 0, data: {}, version: 1 };
const POST = {
	id: 'post-1', org_id: ORG, node_id: 'feed-1', project_id: 'project-1', platform: 'instagram', external_id: 'ig-9', handle: 'atelier', caption: null, permalink: 'https://instagram.com/p/ig-9',
	media: { items: [{ type: 'image', url: 'https://cdn.test/full.jpg', thumbnailUrl: 'https://cdn.test/t.jpg' }] }, metrics: null, posted_at: null, fetched_at: '2026-10-02T00:00:00Z'
};
const PRODUCT = {
	id: 'prod-1', org_id: ORG, node_id: 'shop-1', project_id: 'project-1', platform: 'shopify', external_id: 'sh-4', handle: 'linen-shirt', title: 'Linen shirt', description: null, price: 89, currency: 'EUR',
	url: 'https://shop.test/products/linen-shirt', images: [{ url: 'https://shop.test/a.jpg' }], available: true, compare_at_price: null, tags: [], vendor: null, product_type: null, sku: null,
	variants: [], options: [], synced_at: '2026-10-02T00:00:00Z', created_at: '2026-10-02T00:00:00Z'
};

const png = () => sharp({ create: { width: 300, height: 150, channels: 3, background: '#2244aa' } }).png().toBuffer();

function eventWith(db: unknown, formEntries: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(formEntries)) fd.set(k, v);

	return {
		request: { formData: () => Promise.resolve(fd) },
		params: { canvasId: 'canvas-1' },
		locals: { safeGetSession: async () => ({ session: {}, user: { id: 'user-1' } }), db: async () => db }
	} as never;
}

const ASK = { source: 'feed-1', item_id: 'post-1', image_index: '0', drop: JSON.stringify({ on: 'canvas', x: 600, y: 400 }) };

beforeEach(() => {
	vi.clearAllMocks();
	listMemberships.mockResolvedValue([]);
	findCanvasForUser.mockResolvedValue({ orgId: ORG, canvas: { projectId: 'project-1' } });
});

describe('actions.importFeedImage', () => {
	it('copies a dragged post picture into storage and answers the asset and the node it created', async () => {
		safeFetchBytes.mockResolvedValue({ url: 'https://cdn.test/full.jpg', status: 200, ok: true, mime: 'image/png', bytes: await png() });
		const { db, calls } = fakeDb({ nodes: [FEED, SHOP], social_posts: [POST], products: [PRODUCT], assets: [] }, { filter: true, store: true, newId: () => 'new-id' });

		const result = await actions.importFeedImage(eventWith(db, { ...ASK, node_id: '9b2f6f5e-3c7a-4d0e-9d52-0a1c8e4f7b11' }));

		expect(calls.some((c) => c.table === 'storage:canvas-assets' && c.op === 'upload' && String(c.filters[0]?.[1]).startsWith('org-1/project-1/'))).toBe(true);
		expect(calls.find((c) => c.table === 'assets' && c.op === 'insert')?.payload).toMatchObject({ org_id: ORG, project_id: 'project-1', type: 'image' });
		expect(calls.find((c) => c.table === 'nodes' && c.op === 'insert')?.payload).toMatchObject({ id: '9b2f6f5e-3c7a-4d0e-9d52-0a1c8e4f7b11', type: 'image', canvas_id: 'canvas-1', width: 360, height: 180, actor_kind: 'user' });
		expect(result).toMatchObject({ outcome: 'done', node: { type: 'image' }, asset: { id: 'new-id' } });
	});

	it('works the same for a dragged product picture', async () => {
		safeFetchBytes.mockResolvedValue({ url: 'https://shop.test/a.jpg', status: 200, ok: true, mime: 'image/png', bytes: await png() });
		const { db, calls } = fakeDb({ nodes: [FEED, SHOP], social_posts: [POST], products: [PRODUCT], assets: [] }, { filter: true, store: true, newId: () => 'new-id' });

		await actions.importFeedImage(eventWith(db, { ...ASK, source: 'shop-1', item_id: 'prod-1' }));

		expect(calls.find((c) => c.table === 'nodes' && c.op === 'insert')?.payload).toMatchObject({ data: { source: { kind: 'product', itemId: 'prod-1' } } });
	});

	it('refuses a picture the node does not hold, writing nothing', async () => {
		const { db, calls } = fakeDb({ nodes: [FEED], social_posts: [POST], assets: [] }, { filter: true, store: true });

		const result = await actions.importFeedImage(eventWith(db, { ...ASK, item_id: 'nope' }));

		expect(result).toMatchObject({ status: 400 });
		expect(calls.some((c) => c.op === 'insert')).toBe(false);
	});

	it('refuses a drop that is neither canvas nor frame', async () => {
		const { db } = fakeDb({ nodes: [FEED] }, { filter: true });

		const result = await actions.importFeedImage(eventWith(db, { ...ASK, drop: '{"on":"moon"}' }));

		expect(result).toMatchObject({ status: 400 });
	});
});
