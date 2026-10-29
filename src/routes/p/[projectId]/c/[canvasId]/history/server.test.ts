import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const ORG = 'org-1';
const CANVAS = 'c-1';

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/canvas/lookup', () => ({
  findCanvasForUser: async (_db: unknown, input: { canvasId: string }) => (input.canvasId === CANVAS ? { orgId: ORG, canvas: { id: CANVAS, projectId: 'p-1' } } : null)
}));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));

const { GET, POST } = await import('./+server');

const db = () =>
  fakeDb(
    {
      canvas_events: [{ id: 1, org_id: ORG, canvas_id: CANVAS, kind: 'node.create', node_id: 'n-1', edge_id: null, before: null, after: {}, actor_kind: 'agent', actor_id: 'u-1', agent_key: 'sidebar', created_at: '2026-10-29T10:00:00Z' }]
    },
    { filter: true }
  ).db;

const call = (canvasId: string, query = '', user: unknown = { id: 'u-1' }) => {
  const url = new URL(`https://feega.test/p/p-1/c/${canvasId}/history${query}`);
  const locals = { safeGetSession: async () => ({ user }), db: async () => db() };
  return GET({ locals, params: { projectId: 'p-1', canvasId }, url } as never);
};

describe('the History panel read', () => {
  it('answers the canvas timeline on its author lanes', async () => {
    const body = await (await call(CANVAS)).json();

    expect(body.lanes.map((l: { kind: string }) => l.kind)).toEqual(['chat']);
    expect(body.rows.map((r: { entry: { nodeId: string } }) => r.entry.nodeId)).toEqual(['n-1']);
  });

  it('People leaves the chat out', async () => {
    const body = await (await call(CANVAS, '?author=people')).json();

    expect(body.rows).toEqual([]);
  });

  it('refuses a stranger and a canvas that is not yours', async () => {
    await expect(call(CANVAS, '', null)).rejects.toMatchObject({ status: 401 });
    await expect(call('elsewhere')).rejects.toMatchObject({ status: 404 });
  });

  it('keep theirs from the panel closes a recorded conflict', async () => {
    const fake = fakeDb({ canvas_conflicts: [{ id: 'k-1', org_id: ORG, canvas_id: CANVAS, node_id: 'n-1', expected_version: 3, actual_version: 5, attempt: 'replace', attempted: {}, winning_event_id: 1, actor_kind: 'user', actor_id: 'u-1', agent_key: null, resolution: null, resolved_at: null, created_at: '2026-10-29T10:00:00Z' }] }, { filter: true });
    const url = new URL(`https://feega.test/p/p-1/c/${CANVAS}/history`);
    const request = new Request(url, { method: 'POST', body: JSON.stringify({ conflictId: 'k-1', keep: 'theirs' }) });
    const locals = { safeGetSession: async () => ({ user: { id: 'u-1' } }), db: async () => fake.db };

    const body = await (await POST({ locals, params: { projectId: 'p-1', canvasId: CANVAS }, url, request } as never)).json();

    expect(body).toEqual({ outcome: 'resolved' });
    expect(fake.calls.find((c) => c.table === 'canvas_conflicts' && c.op === 'update')?.payload).toMatchObject({ resolution: 'theirs', resolved_by: 'u-1' });
  });
});
