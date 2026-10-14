import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const gateOrgAiActionForForm = vi.fn();
const findCanvasForUser = vi.fn();
const runGenNode = vi.fn();

vi.mock('$lib/server/cli-auth', () => ({
	gateOrgAiActionForForm: (...a: unknown[]) => gateOrgAiActionForForm(...a)
}));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/canvas/lookup', () => ({
	findCanvasForUser: (...a: unknown[]) => findCanvasForUser(...a)
}));
vi.mock('$lib/server/canvas/generate', () => ({
	runGenNode: (...a: unknown[]) => runGenNode(...a),
	runsOf: vi.fn()
}));

import { actions } from './+page.server';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const [A, B, C] = ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc'];

const node = (id: string, type: string) => ({
	id,
	org_id: ORG,
	canvas_id: CANVAS,
	project_id: PROJECT,
	type,
	display_name: null,
	x: 0,
	y: 0,
	z: 0,
	width: null,
	height: null,
	data: { prompt: id },
	version: 1,
	deleted_at: null
});

const edge = (source: string, target: string) => ({
	id: `${source}-${target}`,
	org_id: ORG,
	canvas_id: CANVAS,
	source_node_id: source,
	target_node_id: target,
	source_handle: null,
	target_handle: null,
	mode: 'fixed',
	deleted_at: null
});

let rows: Record<string, unknown[]>;

function event(form: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(form)) fd.set(k, v);
	const { db } = fakeDb(rows, { filter: true, mutate: true, store: true });
	return {
		request: { formData: () => Promise.resolve(fd) },
		params: { canvasId: CANVAS },
		locals: { safeGetSession: async () => ({ session: {}, user: { id: 'user-1' } }), db: async () => db }
	} as never;
}

const queued = () => (rows.node_runs as { node_id: string; params: { workflow?: unknown } }[]).filter((r) => r.params.workflow).map((r) => r.node_id);

beforeEach(() => {
	vi.clearAllMocks();
	rows = {
		nodes: [node(A, 'text'), node(B, 'image'), node(C, 'video')],
		nodes_connections: [edge(A, B), edge(B, C)],
		node_runs: [],
		canvas_events: []
	};
	gateOrgAiActionForForm.mockResolvedValue(undefined);
	findCanvasForUser.mockResolvedValue({ orgId: ORG, canvas: { projectId: PROJECT } });
});

describe('run downstream from the canvas', () => {
	it('graph_plan quotes the chain and queues nothing', async () => {
		const out = (await actions.graph_plan(event({ graph: 'downstream', node_id: A }))) as { steps: { nodeId: string }[]; credits: number };

		expect(out.steps.map((s) => s.nodeId)).toEqual([A, B, C]);
		expect(out.credits).toBeGreaterThan(0);
		expect(queued()).toEqual([]);
	});

	it('run_graph queues the three runs in dependency order', async () => {
		await actions.run_graph(event({ graph: 'downstream', node_id: A }));

		expect(queued()).toEqual([A, B, C]);
		expect(runGenNode).not.toHaveBeenCalled();
	});

	it('run_graph stops at the credit gate', async () => {
		gateOrgAiActionForForm.mockResolvedValue({ status: 402, data: { error: 'credits_exhausted' } });

		const out = (await actions.run_graph(event({ graph: 'downstream', node_id: A }))) as { status: number };

		expect(out.status).toBe(402);
		expect(queued()).toEqual([]);
	});

	it('an unknown graph is refused', async () => {
		const out = (await actions.run_graph(event({ graph: 'everything' }))) as { status: number };

		expect(out.status).toBe(400);
	});
});
