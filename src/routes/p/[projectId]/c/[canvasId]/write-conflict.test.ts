import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { DataCheck, listNodes, patchNodeData } from '$lib/server/repos/canvas';
import { writeWithRetry } from '$lib/canvas/node-save';

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

function writeEvent(db: unknown, patch: Record<string, unknown>, base: Record<string, unknown>) {
	const fd = new FormData();
	fd.set('node_id', NODE);
	fd.set('patch', JSON.stringify(patch));
	fd.set('base', JSON.stringify(base));
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

function stored(rows: { nodes: Record<string, unknown>[] }) {
	return rows.nodes[0] as { version: number; data: Record<string, unknown> };
}

function kit(data: Record<string, unknown>, version = 7) {
	const rows = { nodes: [{ ...serverRow, data, version }], canvas_events: [{}] };
	const { db, calls } = fakeDb(rows, { filter: true, mutate: true });
	const send = async (patch: Record<string, unknown>, base: Record<string, unknown>) =>
		answerOf(await actions.write(writeEvent(db, patch, base)));
	const reread = async () => {
		const row = (await listNodes(db, { orgId: ORG, canvasId: CANVAS })).find((node) => node.id === NODE);
		return row ? row.data : null;
	};
	return { db, calls, rows, send, reread };
}

describe('actions.write merges a patch into the current row', () => {
	it('a concurrent write on other keys survives the edit', async () => {
		const { send, rows } = kit({ prompt: 'a white cat', status: 'done', refId: 'theirs' }, 8);

		const answer = await send({ prompt: 'a black cat' }, { prompt: 'a white cat' });

		expect(answer.status).toBe(200);
		expect(stored(rows)).toMatchObject({
			version: 9,
			data: { prompt: 'a black cat', status: 'done', refId: 'theirs' }
		});
	});

	it('the same key moved underneath is a 409, and the reapply lands on the fresh row', async () => {
		const { send, reread, rows } = kit({ prompt: 'theirs', status: 'done', refId: 'asset-2' });

		expect((await send({ prompt: 'mine' }, { prompt: 'a white cat' })).status).toBe(409);
		expect(stored(rows).data.prompt).toBe('theirs');

		const out = await writeWithRetry({ send, reread, patch: { prompt: 'mine' }, base: { prompt: 'a white cat' } });

		expect(out.ok).toBe(true);
		expect(stored(rows).data).toEqual({ prompt: 'mine', status: 'done', refId: 'asset-2' });
	});

	it('a merged row the schema refuses is a 400 and nothing is written', async () => {
		const { send, rows } = kit({ prompt: 'a white cat' });

		const answer = await send({ prompt: 42 }, { prompt: 'a white cat' });

		expect(answer.status).toBe(400);
		expect(stored(rows)).toMatchObject({ version: 7, data: { prompt: 'a white cat' } });
	});

	it('a worker closing a run and a user edit are both kept', async () => {
		const { db, send, rows } = kit({ prompt: 'a white cat', running: true, runId: 'run-1' });

		await send({ prompt: 'a black cat' }, { prompt: 'a white cat' });
		await patchNodeData(db, { orgId: ORG, nodeId: NODE, patch: { running: false, refId: 'asset-9' }, check: DataCheck.None });

		expect(stored(rows).data).toEqual({ prompt: 'a black cat', running: false, runId: 'run-1', refId: 'asset-9' });
		expect(stored(rows).version).toBe(9);
	});
});
