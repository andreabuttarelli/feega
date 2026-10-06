import { beforeEach, describe, expect, it, vi } from 'vitest';

const gateOrgAiActionForForm = vi.fn();
const listMemberships = vi.fn();
const findCanvasForUser = vi.fn();
const runGenNode = vi.fn();
const cloneVoice = vi.fn();
const designPreviews = vi.fn();
const deleteVoice = vi.fn();
const voiceSlots = vi.fn();
const list = vi.fn();
const canvasReachable = vi.fn();

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

import { actions } from './+page.server';
vi.mock('$lib/server/uncensored-workspace/workspace-server', async (importOriginal) => ({
	...(await importOriginal<object>()),
	canvasReachable: (...a: unknown[]) => canvasReachable(...a)
}));
vi.mock('$lib/server/voices/voices-config', () => ({
	configuredVoiceDeps: () => ({ store: { list }, provider: {}, bill: vi.fn(), plan: null })
}));
vi.mock('$lib/server/voices/custom-voices', async (importOriginal) => ({
	...(await importOriginal<object>()),
	cloneVoice: (...a: unknown[]) => cloneVoice(...a),
	designPreviews: (...a: unknown[]) => designPreviews(...a),
	deleteVoice: (...a: unknown[]) => deleteVoice(...a),
	voiceSlots: (...a: unknown[]) => voiceSlots(...a)
}));

import { actions } from './+page.server';

function fakeEvent(form: FormData) {
	return {
		request: { formData: () => Promise.resolve(form) },
		params: { canvasId: 'canvas-1' },
		locals: {
			safeGetSession: async () => ({ session: {}, user: { id: 'user-1' } }),
			db: async () => ({})
		}
	} as never;
}

function cloneForm(): FormData {
	const fd = new FormData();
	fd.set('name', 'Me');
	fd.set('consent_basis', 'own_voice');
	fd.set('attested', 'on');
	fd.set('seconds', '65');
	fd.set('sample', new Blob([new Uint8Array([1])], { type: 'audio/webm' }));
	return fd;
}

beforeEach(() => {
	vi.clearAllMocks();
	listMemberships.mockResolvedValue([]);
	canvasReachable.mockResolvedValue(true);
	findCanvasForUser.mockResolvedValue({ orgId: 'org-1', canvas: { projectId: 'project-1' }, mode: 'standard' });
	gateOrgAiActionForForm.mockResolvedValue(undefined);
	cloneVoice.mockResolvedValue({ ok: true, voice: { id: 'v' } });
	voiceSlots.mockResolvedValue({ used: 0, quota: 3, left: 3 });
	list.mockResolvedValue([]);
});

describe('voice actions', () => {
	it('clone with the project mode and the signed-in user, after the credit gate', async () => {
		const out = await actions.voice_clone(fakeEvent(cloneForm()));
		expect(out).toEqual({ voice: { id: 'v' } });
		expect(gateOrgAiActionForForm).toHaveBeenCalledWith('org-1');
		expect(cloneVoice).toHaveBeenCalledWith(
			expect.anything(),
			{ orgId: 'org-1', userId: 'user-1', actor: { kind: 'user', id: 'user-1' } },
			expect.objectContaining({ name: 'Me', mode: 'standard', attested: true, seconds: 65 })
		);
	});

	it('clone is refused with a readable message when no credits are left', async () => {
		gateOrgAiActionForForm.mockResolvedValue({ status: 402, data: { error: 'credits_exhausted' } });
		const out = await actions.voice_clone(fakeEvent(cloneForm()));
		expect((out as { status: number }).status).toBe(402);
		expect(cloneVoice).not.toHaveBeenCalled();
	});

	it('clone refusal comes back as a fail with the message for the user', async () => {
		cloneVoice.mockResolvedValue({ ok: false, error: 'consent_required' });
		const out = (await actions.voice_clone(fakeEvent(cloneForm()))) as { status: number; data: { error: string; message: string } };
		expect(out.status).toBe(400);
		expect(out.data).toMatchObject({ error: 'consent_required', message: expect.stringContaining('consent') });
	});

	it('slots full is a 409', async () => {
		designPreviews.mockResolvedValue({ ok: false, error: 'voice_slots_full' });
		const fd = new FormData();
		fd.set('description', 'a warm older narrator, slow and calm');
		const out = (await actions.voice_design(fakeEvent(fd))) as { status: number };
		expect(out.status).toBe(409);
	});

	it('delete only within the org', async () => {
		deleteVoice.mockResolvedValue({ ok: true });
		const fd = new FormData();
		fd.set('id', 'row-1');
		expect(await actions.voice_delete(fakeEvent(fd))).toEqual({ deleted: true });
		expect(deleteVoice).toHaveBeenCalledWith(expect.anything(), 'org-1', 'row-1');
	});
});
