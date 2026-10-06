import { describe, it, expect, vi, beforeEach } from 'vitest';

const ORG = 'org-1';
const NODE = 'node-1';

const state = vi.hoisted(() => ({ type: 'motion', head: null as null | Record<string, unknown> }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: {}, orgId: ORG, userId: 'u-1', writeAllowed: false } }) }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) =>
    input.orgId === ORG && input.nodeId === NODE ? { id: NODE, canvasId: 'c-1', projectId: 'p-1', type: state.type, displayName: 'Trailer', data: {}, version: 1 } : null
}));
vi.mock('$lib/server/repos/motion-revisions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/motion-revisions')>()),
  readHead: async () => state.head
}));

const { GET } = await import('./+server');

function read(nodeId: string) {
  const url = new URL(`https://feega.test/api/v1/motion/${nodeId}`);
  return GET({ request: new Request(url, { headers: { authorization: 'Bearer t' } }), params: { nodeId }, url } as unknown as Parameters<typeof GET>[0]);
}

beforeEach(() => {
  state.type = 'motion';
  state.head = null;
});

describe('GET /api/v1/motion/[nodeId]', () => {
  it('reads the saved video with a read-only key, in seconds', async () => {
    const res = await read(NODE);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ node_id: NODE, name: 'Trailer', version: 0, editor_url: `/p/p-1/c/c-1/motion/${NODE}` });
    expect(typeof body.doc.duration).toBe('number');
    expect(Array.isArray(body.doc.tracks)).toBe(true);
  });

  it('refuses a node that is not a motion video', async () => {
    state.type = 'image';
    expect((await read(NODE)).status).toBe(404);
  });

  it('refuses a node it cannot see', async () => {
    expect((await read('other')).status).toBe(404);
  });
});
