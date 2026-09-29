import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { listNodes } from '$lib/server/repos/canvas';
import { SaveFailure, writeWithRetry } from '$lib/canvas/node-save';

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

import { actions } from './+page.server';

const ORG = '11111111-1111-1111-1111-111111111111';
const CANVAS = '22222222-2222-2222-2222-222222222222';
const NODE = '33333333-3333-3333-3333-333333333333';

const serverRow = {
	id: NODE,
	org_id: ORG,
	project_id: 'project-1',
	canvas_id: CANVAS,
	type: 'text',
	display_name: null,
	x: 0,
	y: 0,
	z: 0,
	width: null,
	height: null,
	data: { prompt: 'a white cat', status: 'done', refId: 'asset-1' },
	version: 7,
	deleted_at: null,
	created_at: '2026-09-29T00:00:00Z',
	updated_at: '2026-09-29T00:00:00Z'
};

function writeEvent(db: unknown, version: number, data: Record<string, unknown>) {
	const fd = new FormData();
	fd.set('node_id', NODE);
	fd.set('version', String(version));
	fd.set('data', JSON.stringify(data));
	return {
		request: { formData: () => Promise.resolve(fd) },
		params: { canvasId: CANVAS },
		locals: {
			safeGetSession: async () => ({ session: {}, user: { id: 'user-1' } }),
			db: async () => db
		}
	} as never;
}

function answerOf(result: unknown) {
	const failed = result as { status?: number; data?: unknown };
	if (failed && typeof failed.status === 'number' && failed.status >= 400) {
		return { type: 'failure', status: failed.status, data: failed.data };
	}
	return { type: 'success', status: 200, data: result };
}

beforeEach(() => {
	vi.clearAllMocks();
	listMemberships.mockResolvedValue([]);
	findCanvasForUser.mockResolvedValue({ orgId: ORG, canvas: { projectId: 'project-1' } });
});

describe('actions.write with a version left behind by a dropped refresh', () => {
	it('the stale write is a 409, and the retry lands the edit on the fresh row', async () => {
		const { db, calls } = fakeDb({ nodes: [serverRow], canvas_events: [{}] }, { filter: true });
		const send = async (version: number, data: Record<string, unknown>) =>
			answerOf(await actions.write(writeEvent(db, version, data)));
		const reread = async () => {
			const row = (await listNodes(db, { orgId: ORG, canvasId: CANVAS })).find((node) => node.id === NODE);
			return row ? { version: row.version, data: row.data } : null;
		};

		expect((await send(3, { prompt: 'mine' })).status).toBe(409);

		const out = await writeWithRetry({ send, reread, version: 3, patch: { prompt: 'mine' }, data: { prompt: 'mine' } });

		expect(out.ok).toBe(true);
		const lastUpdate = calls.filter((c) => c.op === 'update' && c.table === 'nodes').at(-1)!;
		expect(lastUpdate.filters).toContainEqual(['version', 7]);
		expect(lastUpdate.payload).toMatchObject({ data: { prompt: 'mine', status: 'done', refId: 'asset-1' }, version: 8 });
	});

	it('a write that still conflicts reports Conflict, not a generic failure', async () => {
		const { db } = fakeDb({ nodes: [serverRow] }, { filter: true, updateRows: { nodes: [] } });
		const send = async (version: number, data: Record<string, unknown>) =>
			answerOf(await actions.write(writeEvent(db, version, data)));

		const out = await writeWithRetry({ send, reread: async () => ({ version: 7, data: {} }), version: 3, patch: {}, data: {} });

		expect(out).toMatchObject({ ok: false, reason: SaveFailure.Conflict });
	});
});
