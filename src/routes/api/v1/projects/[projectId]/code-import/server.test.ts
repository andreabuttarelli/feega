import { describe, it, expect, vi, beforeEach } from 'vitest';

const findReachableProject = vi.fn();
const importCodeAt = vi.fn();
const findNode = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/code-import/import-code', async (actual) => ({ ...(await actual<object>()), importCodeAt: (...args: unknown[]) => importCodeAt(...args) }));
vi.mock('$lib/server/repos/canvas', () => ({ findNode: (...args: unknown[]) => findNode(...args) }));
vi.mock('$lib/server/motion/move-element', () => ({ frameStore: () => ({}) }));
vi.mock('$lib/server/canvas/upload', () => ({ importCanvasLink: vi.fn() }));
vi.mock('$lib/server/web/live', () => ({ liveBrowser: () => null }));

const route = await import('./+server');

type Handler = (event: unknown) => Promise<Response>;

async function call(body: unknown, user = 'u1') {
  const locals = { safeGetSession: async () => ({ user: { id: user } }), db: async () => ({}) };
  const url = new URL('https://feega.test/api/v1/projects/p1/code-import');
  const request = new Request(url, { method: 'POST', body: JSON.stringify(body) });
  const res = await (route.POST as Handler)({ params: { projectId: 'p1' }, locals, request, url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
  findNode.mockImplementation(async (_db, { nodeId }) => ({ id: nodeId }));
});

describe('POST /api/v1/projects/:id/code-import', () => {
  it('importa la rotta del repo e risponde col frame e i componenti trovati', async () => {
    importCodeAt.mockResolvedValue({ outcome: 'ok', frameId: 'f1', name: 'Dashboard', undo: [], skipped: [], truncated: false, components: 3, variants: 5, instances: 9 });

    const { res, body } = await call({ canvasId: 'c1', repo: 'https://github.com/a/b', route: '/x', x: 0, y: 0 }, 'u-ok');

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ nodes: [{ id: 'f1' }], components: 3, variants: 5, instances: 9 });
    expect(importCodeAt.mock.calls[0][0]).toMatchObject({ repo: 'https://github.com/a/b', route: '/x', place: { projectId: 'p1', canvasId: 'c1' } });
  });

  it('un repo che non parte torna 422 col motivo', async () => {
    importCodeAt.mockResolvedValue({ outcome: 'run_failed', error: 'install_failed: x' });

    const { res, body } = await call({ canvasId: 'c1', repo: 'https://github.com/a/b', x: 0, y: 0 }, 'u-fail');

    expect(res.status).toBe(422);
    expect(body).toEqual({ error: 'run_failed', detail: 'install_failed: x' });
  });

  it('una richiesta senza repo è invalida', async () => {
    const { res } = await call({ canvasId: 'c1', x: 0, y: 0 }, 'u-bad');

    expect(res.status).toBe(400);
  });
});
