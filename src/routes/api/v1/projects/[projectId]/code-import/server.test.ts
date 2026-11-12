import { describe, it, expect, vi, beforeEach } from 'vitest';

const findReachableProject = vi.fn();
const importCodeAt = vi.fn();
const findNode = vi.fn();
const importRepoAt = vi.fn();
const patchNodeData = vi.fn();
const download = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/code-import/import-code', async (actual) => ({ ...(await actual<object>()), importCodeAt: (...args: unknown[]) => importCodeAt(...args), importRepoAt: (...args: unknown[]) => importRepoAt(...args) }));
vi.mock('$lib/server/repos/canvas', async (actual) => ({ ...(await actual<object>()), findNode: (...args: unknown[]) => findNode(...args), patchNodeData: (...args: unknown[]) => patchNodeData(...args) }));
vi.mock('$lib/server/motion/move-element', () => ({ frameStore: () => ({}) }));
vi.mock('$lib/server/canvas/upload', () => ({ importCanvasLink: vi.fn() }));
vi.mock('$lib/server/web/live', () => ({ liveBrowser: () => null }));

const route = await import('./+server');

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const snapshot = (org: string) => `${org}/33333333-3333-4333-8333-333333333333/code-uploads/44444444-4444-4444-8444-444444444444/my-app`;

type Handler = (event: unknown) => Promise<Response>;

async function call(body: unknown, user = 'u1') {
  const db = { storage: { from: () => ({ download: (...args: unknown[]) => download(...args) }) } };
  const locals = { safeGetSession: async () => ({ user: { id: user } }), db: async () => db };
  const url = new URL('https://feega.test/api/v1/projects/p1/code-import');
  const request = new Request(url, { method: 'POST', body: JSON.stringify(body) });
  const res = await (route.POST as Handler)({ params: { projectId: 'p1' }, locals, request, url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  findReachableProject.mockResolvedValue({ orgId: ORG, project: { id: 'p1' } });
  findNode.mockImplementation(async (_db, { nodeId }) => ({ id: nodeId }));
});

describe('POST /api/v1/projects/:id/code-import', () => {
  it('importa la rotta del repo e risponde col frame e i componenti trovati', async () => {
    importCodeAt.mockResolvedValue({ outcome: 'ok', frameId: 'f1', name: 'Dashboard', undo: [], skipped: [], truncated: false, components: 3, variants: 5, instances: 9 });

    const { res, body } = await call({ canvasId: 'c1', repo: 'https://github.com/a/b', route: '/x', x: 0, y: 0 }, 'u-ok');

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ nodes: [{ id: 'f1' }], components: 3, variants: 5, instances: 9 });
    expect(importCodeAt.mock.calls[0][0]).toMatchObject({ repo: 'https://github.com/a/b', routes: ['/x'], place: { projectId: 'p1', canvasId: 'c1' } });
  });

  it('più rotte arrivano tutte all\'import', async () => {
    importCodeAt.mockResolvedValue({ outcome: 'ok', frameId: 'f1', name: 'app', undo: [], skipped: [], truncated: false, pages: ['/', '/x'], components: 1, variants: 1, instances: 0 });

    const { body } = await call({ canvasId: 'c1', repo: 'https://github.com/a/b', routes: ['/', '/x'], x: 0, y: 0 }, 'u-many');

    expect(body).toMatchObject({ pages: ['/', '/x'] });
    expect(importCodeAt.mock.calls.at(-1)![0]).toMatchObject({ routes: ['/', '/x'] });
  });

  it('Design system è acceso se non lo si spegne, e la risposta conta token e livelli legati', async () => {
    importCodeAt.mockResolvedValue({ outcome: 'ok', frameId: 'f1', name: 'app', undo: [], skipped: [], truncated: false, pages: ['/'], components: 0, variants: 0, instances: 0, design: { tokens: 15, byClass: 9, byRule: 0, byValue: 2, unbound: 4 }, tokenMap: {} });

    const on = await call({ canvasId: 'c1', repo: 'https://github.com/a/b', x: 0, y: 0 }, 'u-ds-on');
    expect(on.body).toMatchObject({ design: { tokens: 15, byClass: 9 } });
    expect(on.body).not.toHaveProperty('tokenMap');
    expect(importCodeAt.mock.calls.at(-1)![0]).toMatchObject({ designSystem: 'on' });

    await call({ canvasId: 'c1', repo: 'https://github.com/a/b', designSystem: false, x: 0, y: 0 }, 'u-ds-off');
    expect(importCodeAt.mock.calls.at(-1)![0]).toMatchObject({ designSystem: 'off' });
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

  it('una cartella caricata parte nella sandbox dal suo archivio e non ha sync', async () => {
    const archive = new Uint8Array([31, 139, 8]);
    download.mockResolvedValue({ data: new Blob([archive]), error: null });
    importRepoAt.mockResolvedValue({ outcome: 'ok', frameId: 'f9', origin: { repo: 'upload/my-app', branch: null, sha: null }, name: 'my-app', undo: [], skipped: [], truncated: false, pages: ['/'], components: 0, variants: 0, instances: 0 });

    const { res } = await call({ canvasId: 'c1', upload: snapshot(ORG), routes: ['/'], x: 0, y: 0 }, 'u-upload');

    expect(res.status).toBe(200);
    expect(download).toHaveBeenCalledWith(snapshot(ORG));
    const ask = importRepoAt.mock.calls.at(-1)![0];
    expect(ask).toMatchObject({ repo: { owner: 'upload', repo: 'my-app', ref: null }, routes: ['/'] });
    expect([...ask.archive]).toEqual([...archive]);
    expect(patchNodeData.mock.calls.at(-1)![1]).toMatchObject({ nodeId: 'f9', patch: { code: { kind: 'upload', repo: snapshot(ORG), branch: null } } });
  });

  it('la cartella caricata da un\'altra org non viene nemmeno scaricata', async () => {
    download.mockClear();

    const { res } = await call({ canvasId: 'c1', upload: snapshot(OTHER), x: 0, y: 0 }, 'u-other');

    expect(res.status).toBe(400);
    expect(download).not.toHaveBeenCalled();
  });

  it('l\'attesa arriva all\'import tagliata al massimo, quella della rotta resta', async () => {
    importCodeAt.mockResolvedValue({ outcome: 'ok', frameId: 'f1', name: 'app', undo: [], skipped: [], truncated: false, pages: ['/'], components: 0, variants: 0, instances: 0 });

    await call({ canvasId: 'c1', repo: 'https://github.com/a/b', routes: ['/', '/x'], captureDelayMs: 999_999, routeDelayMs: { '/x': 0 }, x: 0, y: 0 }, 'u-delay');

    expect(importCodeAt.mock.calls.at(-1)![0].delay).toEqual({ ms: 10_000, routes: { '/x': 0 } });
  });

  it('rifiuta un\'attesa negativa', async () => {
    const { res } = await call({ canvasId: 'c1', repo: 'https://github.com/a/b', captureDelayMs: -1, x: 0, y: 0 }, 'u-neg');

    expect(res.status).toBe(400);
  });
});
