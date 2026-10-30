import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const ORG = 'org-1';
const CANVAS = 'c-1';
const MARCO = 'u-marco';

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async (bearer?: string) => (bearer ? { caller: { db: state.db, orgId: ORG, userId: MARCO, writeAllowed: false } } : { error: { status: 401, body: { error: 'unauthorized' } } }) }));
vi.mock('$lib/server/canvas/lookup', () => ({ openCanvasForUser: async (_db: unknown, i: { canvasId: string }) => ({ memberships: [], found: i.canvasId === CANVAS ? { orgId: ORG, canvas: { id: CANVAS, projectId: 'p-1' }, mode: 'standard', projectBrandId: null } : null }) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));

const { GET } = await import('./+server');

const event = (id: number, actor: Record<string, unknown>, at: string) => ({ id, org_id: ORG, canvas_id: CANVAS, kind: 'node.create', node_id: `n-${id}`, edge_id: null, before: null, after: {}, ...actor, created_at: at });

const get = (canvasId: string, query = '', bearer = 't') => {
  const url = new URL(`https://feega.test/api/v1/canvas/${canvasId}/history${query}`);
  return GET({ request: new Request(url, { headers: bearer ? { authorization: `Bearer ${bearer}` } : {} }), url, params: { canvasId } } as never);
};

const seed = () => {
  state.db = fakeDb(
    {
      canvas_events: [
        event(1, { actor_kind: 'user', actor_id: MARCO, agent_key: null }, '2026-10-29T10:00:00Z'),
        event(2, { actor_kind: 'agent', actor_id: MARCO, agent_key: 'claude-code' }, '2026-10-29T11:00:00Z')
      ],
      profiles: [{ id: MARCO, name: 'Marco', email: null }]
    },
    { filter: true }
  ).db;
};

describe('GET /api/v1/canvas/{id}/history', () => {
  it('answers one timeline with its author lanes', async () => {
    seed();

    const body = await (await get(CANVAS)).json();

    expect(body.lanes.map((l: { label: string; kind: string }) => [l.label, l.kind])).toEqual([['claude-code', 'agent'], ['Marco', 'person']]);
    expect(body.entries.map((e: { kind: string; lane: number; node_id: string }) => [e.kind, e.lane, e.node_id])).toEqual([['node.create', 0, 'n-2'], ['node.create', 1, 'n-1']]);
  });

  it('--ai keeps only agent lanes', async () => {
    seed();

    const body = await (await get(CANVAS, '?author=ai')).json();

    expect(body.entries.map((e: { node_id: string }) => e.node_id)).toEqual(['n-2']);
  });

  it('refuses an unknown filter, a canvas that is not yours and a missing bearer', async () => {
    seed();

    expect((await get(CANVAS, '?author=robots')).status).toBe(400);
    expect((await get('elsewhere')).status).toBe(404);
    expect((await get(CANVAS, '', '')).status).toBe(401);
  });
});
