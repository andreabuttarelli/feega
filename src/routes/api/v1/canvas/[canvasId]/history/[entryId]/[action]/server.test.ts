import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const ORG = 'org-1';
const CANVAS = 'c-1';
const ran: { op: string; projectId: string; input: unknown }[] = [];

const { db } = fakeDb({ canvases: [{ id: CANVAS, org_id: ORG, project_id: 'p-1', deleted_at: null }] }, { filter: true });

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db, orgId: ORG, userId: 'u-1', writeAllowed: true } }) }));
vi.mock('$lib/server/edit/runners', () => ({
  runCanvasOp: async (_caller: unknown, ask: { op: string; projectId: string; input: unknown }) => {
    ran.push(ask);
    return { status: 200, body: { outcome: 'done' } };
  }
}));

const { GET, POST } = await import('./+server');

const call = (handler: typeof GET, canvasId: string, action: string, body?: unknown) => {
  const request = new Request(`https://feega.test/api/v1/canvas/${canvasId}/history/version:v1/${action}`, { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined, headers: { authorization: 'Bearer k' } });
  return handler({ request, url: new URL(request.url), params: { canvasId, entryId: 'version:v1', action } } as never);
};

describe('POST /api/v1/canvas/{id}/history/{entry}/{action}', () => {
  it('restore and name run on the canvas project, preview reads', async () => {
    ran.length = 0;

    await call(POST, CANVAS, 'restore', {});
    await call(POST, CANVAS, 'name', { name: 'Client review' });
    await call(GET, CANVAS, 'preview');

    expect(ran.map((r) => [r.op, r.projectId])).toEqual([
      ['restore_to', 'p-1'],
      ['name_version', 'p-1'],
      ['preview_at', 'p-1']
    ]);
    expect(ran[1].input).toEqual({ canvasId: CANVAS, entryId: 'version:v1', name: 'Client review' });
  });

  it('an unknown action and an unknown canvas are 404', async () => {
    expect((await call(POST, CANVAS, 'explode', {})).status).toBe(404);
    expect((await call(POST, 'elsewhere', 'restore', {})).status).toBe(404);
  });
});
