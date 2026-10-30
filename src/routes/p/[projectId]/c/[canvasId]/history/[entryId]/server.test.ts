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

const snapshot = { nodes: [{ id: 'a', type: 'text', position: { x: 10, y: 0, z: 0 }, size: { width: 100, height: 50 }, data: {} }], connections: [], heads: {} };

const store = () =>
  fakeDb(
    { nodes: [], nodes_connections: [], canvas_events: [], motion_revisions: [], canvas_versions: [{ id: 'v1', org_id: ORG, canvas_id: CANVAS, name: 'Start', created_at: '2026-10-18', snapshot }] },
    { filter: true, store: true }
  );

const event = (entryId: string, body?: unknown, user: unknown = { id: 'u-1' }) => {
  const fake = store();
  const request = new Request(`https://feega.test/p/p-1/c/${CANVAS}/history/${entryId}`, body ? { method: 'POST', body: JSON.stringify(body) } : undefined);
  const locals = { safeGetSession: async () => ({ user }), db: async () => fake.db };
  return { fake, event: { locals, params: { projectId: 'p-1', canvasId: CANVAS, entryId }, request, url: new URL(request.url) } as never };
};

describe('one point of the History panel', () => {
  it('Preview reads the canvas as it was', async () => {
    const { event: e } = event('version:v1');

    expect(await (await GET(e)).json()).toMatchObject({ outcome: 'done', preview: { name: 'Start', nodes: [{ id: 'a' }] } });
  });

  it('Restore to here puts the version back, saving the present first', async () => {
    const { fake, event: e } = event('version:v1', { action: 'restore' });

    expect((await POST(e)).status).toBe(200);
    expect(fake.calls.some((c) => c.table === 'canvas_versions' && c.op === 'insert')).toBe(true);
  });

  it('Revert answers a change that is not there as not found', async () => {
    const { event: e } = event('event:7', { action: 'revert' });

    const res = await POST(e);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ outcome: 'not_found' });
  });

  it('Revert refuses a saved version: that is Restore', async () => {
    const { event: e } = event('version:v1', { action: 'revert' });

    expect((await POST(e)).status).toBe(422);
  });

  it('a point that cannot do the action is refused', async () => {
    const { event: e } = event('event:7', { action: 'restore' });

    expect((await POST(e)).status).toBe(422);
  });

  it('a stranger is refused', async () => {
    const { event: e } = event('version:v1', undefined, null);

    await expect(GET(e)).rejects.toMatchObject({ status: 401 });
  });
});
