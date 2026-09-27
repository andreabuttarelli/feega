import { beforeEach, describe, expect, it, vi } from 'vitest';

const gateOrgAiActionForForm = vi.fn();
const listMemberships = vi.fn();
const findCanvasForUser = vi.fn();
const runGenNode = vi.fn();
const syncProductsNode = vi.fn();
const syncSocialFeedNode = vi.fn();
const syncSocialFeedEntries = vi.fn();
const findNode = vi.fn();
const writeNodeData = vi.fn();

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
vi.mock('$lib/server/canvas/upload', () => ({ registerCanvasUpload: vi.fn(), UploadError: class extends Error {} }));
vi.mock('$lib/server/canvas/loop', () => ({ planLoop: vi.fn(), runLoop: vi.fn() }));
vi.mock('$lib/server/canvas/duplicate', () => ({ duplicateNodes: vi.fn() }));
vi.mock('$lib/server/canvas/undo', () => ({ undoGesture: vi.fn() }));
vi.mock('$lib/server/canvas/products-sync', () => ({ syncProductsNode: (...a: unknown[]) => syncProductsNode(...a) }));
vi.mock('$lib/server/canvas/social-feed-sync', () => ({
	syncSocialFeedNode: (...a: unknown[]) => syncSocialFeedNode(...a),
	syncSocialFeedEntries: (...a: unknown[]) => syncSocialFeedEntries(...a)
}));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
	...(await importOriginal<object>()),
	findNode: (...a: unknown[]) => findNode(...a),
	writeNodeData: (...a: unknown[]) => writeNodeData(...a)
}));
vi.mock('$lib/canvas/doc-node', async (importOriginal) => ({ ...(await importOriginal<object>()), mintShareToken: vi.fn() }));
vi.mock('$lib/server/repos/doc-share', () => ({ clearDocShare: vi.fn(), setDocShare: vi.fn() }));
vi.mock('$lib/server/canvas-catalogue', () => ({ canvasModelCatalogue: vi.fn() }));
vi.mock('$lib/server/repos/products', () => ({ listNodeProducts: vi.fn() }));
vi.mock('$lib/server/repos/social-posts', () => ({ listNodeSocialPosts: vi.fn() }));
vi.mock('$lib/server/repos/influencers', () => ({
	getInfluencer: vi.fn(),
	listInfluencerViewsByIds: vi.fn(),
	signInfluencerViewFiles: vi.fn()
}));

import { actions } from './+page.server';

function fakeEvent(formEntries: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(formEntries)) fd.set(k, v);

	return {
		request: { formData: () => Promise.resolve(fd) },
		params: { canvasId: 'canvas-1' },
		locals: {
			safeGetSession: async () => ({ session: {}, user: { id: 'user-1' } }),
			db: async () => ({})
		}
	} as never;
}

function nodeWith(type: string, data: Record<string, unknown>) {
	findNode.mockResolvedValue({ id: 'node-1', type, version: 1, data });
	writeNodeData.mockImplementation(async (_db: unknown, input: { data: Record<string, unknown>; expectedVersion: number }) => ({
		outcome: 'ok',
		node: { id: 'node-1', type, version: input.expectedVersion + 1, data: input.data }
	}));
}

beforeEach(() => {
	vi.clearAllMocks();
	listMemberships.mockResolvedValue([]);
	findCanvasForUser.mockResolvedValue({ orgId: 'org-1', canvas: { projectId: 'project-1' } });
	syncProductsNode.mockResolvedValue({ ok: true, synced: 0, after: null });
	syncSocialFeedNode.mockResolvedValue({ ok: true, synced: 0 });
	syncSocialFeedEntries.mockResolvedValue({ ok: true, synced: 0, entries: [], unsupported: [] });
});

describe('actions.sync legge la query come la scrive una persona', () => {
	it('un handle incollato come URL del profilo scarica l’account giusto', async () => {
		nodeWith('social_account_feed', { platform: 'instagram', handle: 'https://www.instagram.com/@nike/' });

		await actions.sync(fakeEvent({ node_id: 'node-1', version: '1' }));

		expect(syncSocialFeedEntries).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ raw: 'https://www.instagram.com/@nike/' })
		);
	});

	it('un handle nudo, senza URL, scarica ancora per la via diretta', async () => {
		nodeWith('social_account_feed', { platform: 'instagram', handle: 'nike' });

		await actions.sync(fakeEvent({ node_id: 'node-1', version: '1' }));

		expect(syncSocialFeedNode).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ handle: 'nike' }));
	});

	it('uno store scritto senza schema e con la categoria arriva completo al fetch', async () => {
		nodeWith('products', { type: 'shopify', url: 'shop.example.com', category: 'sale' });

		await actions.sync(fakeEvent({ node_id: 'node-1', version: '1' }));

		expect(syncProductsNode).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ storeUrl: 'https://shop.example.com/', category: 'sale' })
		);
	});
});
