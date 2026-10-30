import { describe, it, expect, vi, beforeEach } from 'vitest';

const findReachableProject = vi.fn();
const importPageAt = vi.fn();
const findNode = vi.fn();
const findSiteBrand = vi.fn(async () => null as unknown);

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/url-import/import-url', async (actual) => ({ ...(await actual<object>()), importPageAt: (...args: unknown[]) => importPageAt(...args) }));
vi.mock('$lib/server/repos/canvas', () => ({ findNode: (...args: unknown[]) => findNode(...args) }));
vi.mock('$lib/server/motion/move-element', () => ({ frameStore: () => ({}) }));
vi.mock('$lib/server/canvas/upload', () => ({ importCanvasLink: vi.fn() }));
vi.mock('$lib/server/web/live', () => ({ liveBrowser: () => null }));
vi.mock('$lib/server/start/site-brand', () => ({ findSiteBrand: (...args: unknown[]) => findSiteBrand(...(args as [])) }));

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

  it('divide la pagina in sezioni di default, e non lo fa con sections false', async () => {
    importPageAt.mockReset();
    importPageAt.mockResolvedValue({ outcome: 'ok', frameId: 'f1', name: 'Acme', undo: [], skipped: [], truncated: false });

    await call({ canvasId: 'c1', url: 'https://acme.test', x: 0, y: 0 }, 'u-sections-on');
    await call({ canvasId: 'c1', url: 'https://acme.test', x: 0, y: 0, sections: false }, 'u-sections-off');

    expect(importPageAt.mock.calls.map((c) => c[0].shape?.sectioning)).toEqual(['on', 'off']);
  });

  it('estrae i token di default, e non lo fa con tokens false', async () => {
    importPageAt.mockReset();
    importPageAt.mockResolvedValue({ outcome: 'ok', frameId: 'f1', name: 'Acme', undo: [], skipped: [], truncated: false });

    await call({ canvasId: 'c1', url: 'https://acme.test', x: 0, y: 0 }, 'u-tokens-on');
    await call({ canvasId: 'c1', url: 'https://acme.test', x: 0, y: 0, tokens: false }, 'u-tokens-off');

    expect(importPageAt.mock.calls.map((c) => c[0].shape?.tokening)).toEqual(['on', 'off']);
  });

  it('allinea i token alla palette del brand dello stesso sito', async () => {
    importPageAt.mockReset();
    importPageAt.mockResolvedValue({ outcome: 'ok', frameId: 'f1', name: 'Acme', undo: [], skipped: [], truncated: false });
    findSiteBrand.mockResolvedValueOnce({ id: 'b1', kit: { palette: [{ hex: '#533AFD' }], fonts: ['Inter'] } });

    await call({ canvasId: 'c1', url: 'https://www.acme.test/pricing', x: 0, y: 0 }, 'u-brand');

    expect(findSiteBrand.mock.calls.at(-1)?.slice(1)).toEqual(['o1', 'acme.test']);
    expect(importPageAt.mock.calls[0][0].shape?.brand).toEqual({ palette: ['#533AFD'] });
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

  it('the top extent caps the page at the first screens', async () => {
    importPageAt.mockResolvedValue({ outcome: 'ok', frameId: 'f1', name: 'Acme', undo: [], skipped: [], truncated: true });

    const { body } = await call({ canvasId: 'c1', url: 'https://acme.test', x: 0, y: 0, extent: 'top' }, 'u-top');

    expect(importPageAt.mock.lastCall?.[0].maxHeight).toBe(1800);
    expect(body.truncated).toBe(true);
  });

  it('without an extent the whole page is read, as before', async () => {
    importPageAt.mockResolvedValue({ outcome: 'ok', frameId: 'f1', name: 'Acme', undo: [], skipped: [], truncated: false });

    await call({ canvasId: 'c1', url: 'https://acme.test', x: 0, y: 0 }, 'u-full');

    expect(importPageAt.mock.lastCall?.[0].maxHeight).toBeUndefined();
  });
});
