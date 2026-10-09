import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';

const ORG = 'org-1';

const state = vi.hoisted(() => ({ writeAllowed: true, db: null as unknown }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: state.db, orgId: ORG, userId: 'u-1', writeAllowed: state.writeAllowed } }) }));

const { GET, POST, PATCH } = await import('./+server');

const row = (id: string, canvas: string, type: string, data: Record<string, unknown>) => ({ id, org_id: ORG, canvas_id: canvas, project_id: 'p-1', type, display_name: 'Launch', x: 0, y: 0, z: 0, width: null, height: null, data, version: 1, deleted_at: null });

const call = (handler: typeof GET, nodeId: string, method = 'GET', body?: unknown) => {
  const url = new URL(`https://feega.test/api/v1/motion/${nodeId}/storyboard`);
  const request = new Request(url, { method, headers: { authorization: 'Bearer t' }, body: body ? JSON.stringify(body) : undefined });
  return handler({ request, params: { nodeId }, url } as never);
};

const BEAT = { act: 'problem', kind: 'scene', title: 'Folders', intent: 'the mess', emotion: 'tense', intensity: 0.4, duration: 3 };

let fake: FakeDb;

beforeEach(() => {
  fake = fakeDb(
    {
      nodes: [row('m-1', 'home', 'motion', { format: '16:9', storyboard: { canvasId: 'board', placed: [] } }), row('card', 'board', 'doc', { content: '## Folders', public: false })],
      nodes_connections: [],
      canvases: [],
      canvas_events: [],
      assets: []
    },
    { filter: true }
  );
  state.db = fake.db;
  state.writeAllowed = true;
});

describe('/api/v1/motion/[nodeId]/storyboard', () => {
  it('GET reads the board with its cards', async () => {
    const body = await (await call(GET, 'm-1')).json();

    expect(body).toMatchObject({ canvas_id: 'board', cards: [{ node_id: 'card', text: '## Folders', clip_ids: [] }] });
  });

  it('GET answers 404 for a node that is not a motion video', async () => {
    expect((await call(GET, 'card')).status).toBe(404);
  });

  it('POST writes the board from beats', async () => {
    const res = await call(POST, 'm-1', 'POST', { beats: [BEAT] });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ canvas_id: 'board' });
    expect(fake.calls.filter((c) => c.table === 'nodes' && c.op === 'insert')).toHaveLength(2);
  });

  it('POST refuses an invalid board, a media id the project lacks and a read-only key', async () => {
    expect((await call(POST, 'm-1', 'POST', { beats: [] })).status).toBe(400);
    expect((await call(POST, 'm-1', 'POST', { beats: [{ ...BEAT, media: ['nope'] }] })).status).toBe(400);
    state.writeAllowed = false;
    expect((await call(POST, 'm-1', 'POST', { beats: [BEAT] })).status).toBe(403);
  });

  it('PATCH rewrites one card', async () => {
    const res = await call(PATCH, 'm-1', 'PATCH', { card_id: 'card', text: '## New' });

    expect(res.status).toBe(200);
    expect(fake.calls.find((c) => c.table === 'nodes' && c.op === 'update')?.payload).toMatchObject({ data: { content: '## New' } });
  });
});
