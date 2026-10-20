import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { appendRevision } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';

const ORG = 'org-1';
const NODE = 'node-1';
const CANVAS = 'c-1';

const state = vi.hoisted(() => ({ db: null as unknown, framesOpen: false }));

const frameNode = { id: NODE, canvasId: CANVAS, projectId: 'p-1', type: 'motion', displayName: 'Poster', position: { x: 1, y: 2, z: 0 }, size: { width: 540, height: 675 }, data: {}, version: 1 };

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: state.db, orgId: ORG, userId: 'u-1', writeAllowed: false } }) }));
vi.mock('$lib/server/org-data/reach', () => ({ callerReach: async () => null }));
vi.mock('$lib/server/canvas/lookup', () => ({ openCanvasForUser: async (_db: unknown, i: { canvasId: string }) => ({ memberships: [], found: i.canvasId === CANVAS ? { orgId: ORG, canvas: { id: CANVAS, projectId: 'p-1' }, mode: 'standard', projectBrandId: null } : null }) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));
vi.mock('$lib/server/canvas/snapshot', () => ({ loadGenRuns: async () => ({ [NODE]: [{ status: 'done' }] }) }));
vi.mock('$lib/server/repos/canvas-events', () => ({ listCanvasEvents: async () => [{ kind: 'node.create', nodeId: NODE, edgeId: null, actorKind: 'agent', agentKey: 'mcp', createdAt: '2026-10-20T10:00:00Z' }] }));
vi.mock('$lib/server/repos/node-runs', () => ({ runningRuns: async () => [{ id: 'r1', nodeId: NODE, model: 'm', startedAt: '2026-10-20T10:01:00Z' }, { id: 'r2', nodeId: 'elsewhere', model: 'm', startedAt: '2026-10-20T10:01:00Z' }] }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  listNodes: async () => [frameNode],
  listConnections: async () => [],
  findNode: async (_db: unknown, i: { nodeId: string }) => (i.nodeId === NODE ? frameNode : null)
}));
vi.mock('$lib/server/motion/chromium-frames', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/motion/chromium-frames')>()), serverFramesOpen: () => state.framesOpen }));

const { POST } = await import('./+server');

const post = (body: unknown) => {
  const url = new URL('https://feega.test/api/v1/view');
  return POST({ request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) }), url } as never);
};

const doc = (): MotionDoc => ({ ...newMotionDoc(MotionFormat.Portrait), tracks: [{ id: 't1', name: 'Layers', kind: 'visual', clips: [{ id: 'c1', component: 'Title', from: 0, durationInFrames: 60, props: { text: 'Hello', x: 0.5, y: 0.5, width: 0.5, height: 0.2 } }] } as never] });

beforeEach(async () => {
  const fake = revisionsDb();
  state.db = fake.db;
  state.framesOpen = false;
  await appendRevision(fake.db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: doc(), actor: { kind: 'user', id: 'u-1' }, summary: 'start' });
});

describe('POST /api/v1/view lets an outside agent see the canvas', () => {
  it('canvas_summary outlines nodes and the elements of each frame', async () => {
    const res = await post({ op: 'canvas_summary', input: { canvas_id: CANVAS } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nodes[0]).toMatchObject({ id: NODE, type: 'motion', title: 'Poster', run: 'done', elements: [{ id: 'c1', text: 'Hello', bounds: { left: 270 } }] });
  });

  it('get gives one element by frame and element id, or one node', async () => {
    const element = await (await post({ op: 'get', input: { id: 'c1', frame_id: NODE } })).json();
    const node = await (await post({ op: 'get', input: { id: NODE } })).json();

    expect(element).toMatchObject({ frame_id: NODE, element: { id: 'c1', props: { text: 'Hello' } } });
    expect(node.node.id).toBe(NODE);
    expect((await post({ op: 'get', input: { id: 'c1', frame_id: 'nope' } })).status).toBe(404);
  });

  it('activity lists events and the runs of this canvas only, and says presence is not readable', async () => {
    const body = await (await post({ op: 'activity', input: { canvas_id: CANVAS } })).json();

    expect(body.events).toEqual([{ kind: 'node.create', node_id: NODE, edge_id: null, actor: 'agent', agent: 'mcp', at: '2026-10-20T10:00:00Z' }]);
    expect(body.running.map((r: { run_id: string }) => r.run_id)).toEqual(['r1']);
    expect(body.presence.available).toBe(false);
  });

  it('activity since leaves out older events', async () => {
    const body = await (await post({ op: 'activity', input: { canvas_id: CANVAS, since: '2026-10-20T11:00:00Z' } })).json();

    expect(body.events).toEqual([]);
  });

  it('snapshot says plainly when the server renderer is closed, and refuses an element alone', async () => {
    const closed = await post({ op: 'snapshot', input: { node_id: NODE } });
    const element = await post({ op: 'snapshot', input: { node_id: NODE, element_id: 'c1' } });

    expect(closed.status).toBe(503);
    expect(await closed.json()).toMatchObject({ error: 'server_frames_unavailable' });
    expect(element.status).toBe(400);
    expect(await element.json()).toMatchObject({ error: 'snapshot_unsupported' });
  });

  it('describe lists the four ops with strict schemas; an unknown op is refused', async () => {
    const body = await (await post({ op: 'describe' })).json();

    expect(body.ops.map((o: { name: string }) => o.name)).toEqual(['canvas_summary', 'get', 'activity', 'snapshot']);
    expect(body.schemas[0].input_schema.type).toBe('object');
    expect((await post({ op: 'nope' })).status).toBe(400);
  });
});
