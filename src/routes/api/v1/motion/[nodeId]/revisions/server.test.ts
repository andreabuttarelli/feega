import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { appendRevision } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';

const ORG = 'org-1';
const NODE = 'node-1';

const state = vi.hoisted(() => ({ writeAllowed: true, db: null as unknown }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: state.db, orgId: ORG, userId: 'u-1', writeAllowed: state.writeAllowed } }) }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  patchNodeData: vi.fn(async () => ({ ok: true })),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) =>
    input.orgId === ORG && input.nodeId === NODE ? { id: NODE, canvasId: 'c-1', projectId: 'p-1', type: 'motion', displayName: 'Trailer', data: {}, version: 1 } : null
}));

const { GET, POST } = await import('./+server');

const call = (handler: typeof GET | typeof POST, nodeId: string, body?: unknown) => {
  const url = new URL(`https://feega.test/api/v1/motion/${nodeId}/revisions`);
  const request = new Request(url, { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer t' }, body: body ? JSON.stringify(body) : undefined });
  return handler({ request, params: { nodeId }, url } as never);
};

let rows: Record<string, unknown>[];

beforeEach(async () => {
  const fake = revisionsDb();
  state.db = fake.db;
  state.writeAllowed = true;
  rows = fake.rows;
  const actor = { kind: 'user' as const, id: 'u-1' };
  await appendRevision(fake.db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 600 }, actor, summary: 'good' });
  await appendRevision(fake.db, { orgId: ORG, nodeId: NODE, expectedVersion: 1, doc: newMotionDoc(MotionFormat.Landscape), actor, summary: 'Undo' });
});

describe('/api/v1/motion/[nodeId]/revisions', () => {
  it('GET lists the saved versions newest first', async () => {
    const body = await (await call(GET, NODE)).json();

    expect(body.revisions.map((r: { version: number }) => r.version)).toEqual([2, 1]);
  });

  it('POST restores a version as a new one, keeping the history', async () => {
    const res = await call(POST, NODE, { version: 1 });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ version: 3, restored: 1 });
    expect(rows).toHaveLength(3);
  });

  it('POST refuses a read-only key and a missing version', async () => {
    expect((await call(POST, NODE, { version: 9 })).status).toBe(404);
    state.writeAllowed = false;
    expect((await call(POST, NODE, { version: 1 })).status).toBe(403);
    expect(rows).toHaveLength(2);
  });

  it('refuses a node it cannot see', async () => {
    expect((await call(GET, 'other')).status).toBe(404);
  });
});
