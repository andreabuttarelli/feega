import { beforeEach, describe, expect, it, vi } from 'vitest';

const gateOrgAiActionForForm = vi.fn();
const listMemberships = vi.fn();
const findCanvasForUser = vi.fn();
const runGenNode = vi.fn();
const registerCanvasUpload = vi.fn();
const registerUploadedAsset = vi.fn();
const setCanvasShare = vi.fn();

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
vi.mock('$lib/server/canvas/upload', () => ({
	registerCanvasUpload: (...a: unknown[]) => registerCanvasUpload(...a),
	registerUploadedAsset: (...a: unknown[]) => registerUploadedAsset(...a),
	UploadError: class extends Error {}
}));
vi.mock('$lib/server/canvas/loop', () => ({ planLoop: vi.fn(), runLoop: vi.fn() }));
vi.mock('$lib/server/canvas/duplicate', () => ({ duplicateNodes: vi.fn() }));
vi.mock('$lib/server/canvas/undo', () => ({ undoGesture: vi.fn() }));
vi.mock('$lib/server/canvas/products-sync', () => ({ syncProductsNode: vi.fn() }));
vi.mock('$lib/server/canvas/social-feed-sync', () => ({ syncSocialFeedNode: vi.fn() }));
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
vi.mock('$lib/server/canvas/canvas-share', () => ({
	ShareState: { On: 'on', Off: 'off' },
	setCanvasShare: (...a: unknown[]) => setCanvasShare(...a)
}));

const nsfwLockFor = vi.fn();
vi.mock('$lib/server/nsfw/nsfw-server', () => ({ nsfwLockFor: (...a: unknown[]) => nsfwLockFor(...a) }));

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

beforeEach(() => {
	vi.clearAllMocks();
	listMemberships.mockResolvedValue([]);
	findCanvasForUser.mockResolvedValue({ orgId: 'org-1', canvas: { projectId: 'project-1' } });
});

describe('actions.share_canvas', () => {
	it('a member turns the link on and gets the public path', async () => {
		setCanvasShare.mockResolvedValue('tok-1');

		const result = await actions.share_canvas(fakeEvent({ state: 'on' }));

		expect(setCanvasShare).toHaveBeenCalledWith(expect.anything(), { orgId: 'org-1', canvasId: 'canvas-1', state: 'on' });
		expect(result).toEqual({ shareToken: 'tok-1' });
	});

	it('a member revokes the link', async () => {
		setCanvasShare.mockResolvedValue(null);

		const result = await actions.share_canvas(fakeEvent({ state: 'off' }));

		expect(setCanvasShare).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ state: 'off' }));
		expect(result).toEqual({ shareToken: null });
	});

	it('a non-member cannot share someone else’s canvas', async () => {
		findCanvasForUser.mockResolvedValue(null);

		await expect(actions.share_canvas(fakeEvent({ state: 'on' }))).rejects.toMatchObject({ status: 404 });
		expect(setCanvasShare).not.toHaveBeenCalled();
	});

	it('a canvas of an nsfw project is never shared, even by a verified member', async () => {
		findCanvasForUser.mockResolvedValue({ orgId: 'org-1', canvas: { projectId: 'project-1' }, mode: 'nsfw' });
		nsfwLockFor.mockResolvedValue('open');

		await expect(actions.share_canvas(fakeEvent({ state: 'on' }))).rejects.toMatchObject({ status: 403 });
		expect(setCanvasShare).not.toHaveBeenCalled();
	});

	it('a canvas of an nsfw project is not found for a member whose nsfw access is locked', async () => {
		findCanvasForUser.mockResolvedValue({ orgId: 'org-1', canvas: { projectId: 'project-1' }, mode: 'nsfw' });
		nsfwLockFor.mockResolvedValue('age_unverified');

		await expect(actions.share_canvas(fakeEvent({ state: 'off' }))).rejects.toMatchObject({ status: 404 });
	});

	it('an unknown state is refused', async () => {
		const result = await actions.share_canvas(fakeEvent({ state: 'maybe' }));

		expect(result).toMatchObject({ status: 400 });
		expect(setCanvasShare).not.toHaveBeenCalled();
	});
});
