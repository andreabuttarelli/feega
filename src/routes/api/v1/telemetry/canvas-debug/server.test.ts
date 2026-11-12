import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDb } from '$lib/server/local/memory-db';

type Tables = Map<string, Record<string, unknown>[]>;

const { written } = vi.hoisted(() => ({ written: { tables: null as unknown as Map<string, Record<string, unknown>[]> } }));

vi.mock('$lib/server/db/client', async (actual) => {
  const { createMemoryDb: memory } = await import('$lib/server/local/memory-db');
  return { ...(await actual<object>()), createServiceRoleDb: () => memory({ tables: written.tables, blobs: new Map(), user: { id: 'svc', email: 's@x', created_at: '2026-01-01' }, storageUrl: () => '', onChange: () => {} }) };
});

const { POST } = await import('./+server');

const CANVAS = 'c-mine';
const OTHER = 'c-theirs';

const userDb = () => {
  const tables: Tables = new Map([['canvases', [{ id: CANVAS, org_id: 'org-1', deleted_at: null }]]]);
  return createMemoryDb({ tables, blobs: new Map(), user: { id: 'alice', email: 'a@x', created_at: '2026-01-01' }, storageUrl: () => '', onChange: () => {} });
};

const signedIn = (id: string) => ({ safeGetSession: async () => ({ user: { id } }), db: async () => userDb() });

const post = (body: unknown, locals: unknown = signedIn('alice')) => POST({ request: new Request('https://feega.test/api/v1/telemetry/canvas-debug', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), locals } as never);

const batch = (session: string, canvas: string, seqs: number[]) => ({ v: 1, session, canvas, lines: seqs.map((s) => ({ s, t: s * 250, k: s === 0 ? 'start' : 'sample', p: { zoom: 2 } })) });

const rows = () => written.tables.get('canvas_debug_logs') ?? [];

describe('POST /api/v1/telemetry/canvas-debug', () => {
  beforeEach(() => {
    written.tables = new Map();
  });

  it('stores every line of a session in order, with the user, org and canvas', async () => {
    const res = await post(batch('sess000001', CANVAS, [0, 1, 2]));

    expect(res.status).toBe(204);
    expect(rows().map((r) => [r.session, r.seq, r.kind, r.user_id, r.org_id, r.canvas_id])).toEqual([
      ['sess000001', 0, 'start', 'alice', 'org-1', CANVAS],
      ['sess000001', 1, 'sample', 'alice', 'org-1', CANVAS],
      ['sess000001', 2, 'sample', 'alice', 'org-1', CANVAS]
    ]);
    expect(rows()[1].props).toEqual({ zoom: 2 });
    expect(rows()[2].t_ms).toBe(500);
  });

  it('keeps the lines but not the canvas id when the user cannot open that canvas', async () => {
    await post(batch('sess000002', OTHER, [0]));

    expect(rows()).toHaveLength(1);
    expect(rows()[0].canvas_id).toBeNull();
    expect(rows()[0].org_id).toBeNull();
  });

  it('refuses a caller with no session and stores nothing', async () => {
    const res = await post(batch('sess000003', CANVAS, [0]), { safeGetSession: async () => ({ user: null }), db: async () => null });

    expect(res.status).toBe(401);
    expect(rows()).toHaveLength(0);
  });

  it('refuses a malformed or oversized body', async () => {
    expect((await post('not json')).status).toBe(400);
    expect((await post({ ...batch('sess000004', CANVAS, [0]), pad: 'x'.repeat(200_000) })).status).toBe(413);
    expect(rows()).toHaveLength(0);
  });
});
