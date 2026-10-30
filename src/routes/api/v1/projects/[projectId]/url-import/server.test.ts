import { describe, it, expect, vi, beforeEach } from 'vitest';

const findReachableProject = vi.fn();
const importPageAt = vi.fn();
const findNode = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/url-import/import-url', async (actual) => ({ ...(await actual<object>()), importPageAt: (...args: unknown[]) => importPageAt(...args) }));
vi.mock('$lib/server/repos/canvas', () => ({ findNode: (...args: unknown[]) => findNode(...args) }));
vi.mock('$lib/server/motion/move-element', () => ({ frameStore: () => ({}) }));
vi.mock('$lib/server/canvas/upload', () => ({ importCanvasLink: vi.fn() }));
vi.mock('$lib/server/web/live', () => ({ liveBrowser: () => null }));

const route = await import('./+server');

type Handler = (event: unknown) => Promise<Response>;

async function call(body: unknown, user = 'u1') {
  const locals = { safeGetSession: async () => ({ user: { id: user } }), db: async () => ({}) };
  const url = new URL('https://feega.test/api/v1/projects/p1/url-import');
  const request = new Request(url, { method: 'POST', body: JSON.stringify(body) });
  const res = await (route.POST as Handler)({ params: { projectId: 'p1' }, locals, request, url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
  findNode.mockImplementation(async (_db, { nodeId }) => ({ id: nodeId }));
});

describe('POST /api/v1/projects/:id/url-import', () => {
  it('importa la pagina e risponde col nodo del frame', async () => {
    importPageAt.mockResolvedValue({ outcome: 'ok', frameId: 'f1', name: 'Acme', undo: [], skipped: [], truncated: false });

    const { res, body } = await call({ canvasId: 'c1', url: 'https://acme.test', x: 0, y: 0 }, 'u-ok');

    expect(res.status).toBe(200);
    expect(body.nodes).toEqual([{ id: 'f1' }]);
    expect(importPageAt.mock.calls[0][0]).toMatchObject({ url: 'https://acme.test', place: { projectId: 'p1', canvasId: 'c1' } });
  });

  it('un indirizzo privato torna 400 not_public', async () => {
    importPageAt.mockResolvedValue({ outcome: 'not_public' });

    const { res, body } = await call({ canvasId: 'c1', url: 'http://169.254.169.254/', x: 0, y: 0 }, 'u-private');

    expect(res.status).toBe(400);
    expect(body.error).toBe('not_public');
  });

  it('una richiesta senza canvas è invalida', async () => {
    const { res } = await call({ url: 'https://acme.test', x: 0, y: 0 }, 'u-bad');

    expect(res.status).toBe(400);
  });
});
