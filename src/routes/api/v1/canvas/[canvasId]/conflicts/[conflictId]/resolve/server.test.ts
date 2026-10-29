import { describe, expect, it, vi } from 'vitest';
import { fakeDb, type Call } from '$lib/server/db/fake-db';

const ORG = 'org-1';
const CANVAS = 'c-1';
const MARCO = 'u-marco';

const state = vi.hoisted(() => ({ db: null as unknown, calls: [] as unknown[] }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async (bearer?: string) => (bearer ? { caller: { db: state.db, orgId: ORG, userId: MARCO, writeAllowed: true } } : { error: { status: 401, body: { error: 'unauthorized' } } }) }));
vi.mock('$lib/server/canvas/lookup', () => ({ openCanvasForUser: async (_db: unknown, i: { canvasId: string }) => ({ memberships: [], found: i.canvasId === CANVAS ? { orgId: ORG, canvas: { id: CANVAS, projectId: 'p-1' }, mode: 'standard', projectBrandId: null } : null }) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));

const { POST } = await import('./+server');

const seed = () => {
  const fake = fakeDb(
    {
      projects: [{ id: 'p-1', org_id: ORG, name: 'P', brand_id: null, mode: 'standard' }],
      canvases: [{ id: CANVAS, org_id: ORG, project_id: 'p-1', name: 'C', viewport: null }],
      canvas_conflicts: [{ id: 'k-1', org_id: ORG, canvas_id: CANVAS, node_id: 'n-1', expected_version: 3, actual_version: 5, attempt: 'replace', attempted: { prompt: 'mine' }, winning_event_id: 41, actor_kind: 'user', actor_id: MARCO, agent_key: null, resolution: null, resolved_at: null, created_at: '2026-10-29T10:00:00Z' }]
    },
    { filter: true }
  );
  state.db = fake.db;
  state.calls = fake.calls;
};

const post = (canvasId: string, keep: string, bearer = 't') => {
  const url = new URL(`https://feega.test/api/v1/canvas/${canvasId}/conflicts/k-1/resolve`);
  return POST({ request: new Request(url, { method: 'POST', body: JSON.stringify({ keep }), headers: bearer ? { authorization: `Bearer ${bearer}` } : {} }), url, params: { canvasId, conflictId: 'k-1' } } as never);
};

describe('POST /api/v1/canvas/{id}/conflicts/{conflictId}/resolve', () => {
  it('keep theirs closes the recorded conflict', async () => {
    seed();

    const body = await (await post(CANVAS, 'theirs')).json();

    expect(body).toEqual({ resolved: true, keep: 'theirs' });
    expect((state.calls as Call[]).find((c) => c.table === 'canvas_conflicts' && c.op === 'update')?.payload).toMatchObject({ resolution: 'theirs' });
  });

  it('refuses an unknown side, a canvas that is not yours and a missing bearer', async () => {
    seed();

    expect((await post(CANVAS, 'both')).status).toBe(400);
    expect((await post('elsewhere', 'mine')).status).toBe(404);
    expect((await post(CANVAS, 'mine', '')).status).toBe(401);
  });
});
