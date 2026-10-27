import { describe, it, expect, vi, beforeEach } from 'vitest';

const findReachableProject = vi.fn();
const readToken = vi.fn();
const importFigmaFrames = vi.fn();
const findNode = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/figma/token-store', () => ({ figmaTokenStore: () => ({ read: readToken }) }));
vi.mock('$lib/server/figma/import-frames', () => ({ importFigmaFrames: (...args: unknown[]) => importFigmaFrames(...args) }));
vi.mock('$lib/server/repos/canvas', () => ({ findNode: (...args: unknown[]) => findNode(...args) }));
vi.mock('$lib/server/motion/move-element', () => ({ frameStore: () => ({}) }));
vi.mock('$lib/server/canvas/upload', () => ({ importCanvasLink: vi.fn() }));

const frames = await import('./frames/+server');
const imports = await import('./import/+server');

const FILE = 'AbCdEf1234567890';
const LINK = `https://www.figma.com/design/${FILE}/Kit?node-id=1-2`;

type Handler = (event: unknown) => Promise<Response>;

async function call(route: { POST: unknown }, body: unknown, user = 'u1') {
  const locals = { safeGetSession: async () => ({ user: { id: user } }), db: async () => ({}) };
  const url = new URL('https://feega.test/api/v1/projects/p1/figma');
  const request = new Request(url, { method: 'POST', body: JSON.stringify(body) });
  const res = await (route.POST as Handler)({ params: { projectId: 'p1' }, locals, request, url });
  return { res, body: await res.json() };
}

const document = { children: [{ id: '0:1', name: 'Page', type: 'CANVAS', children: [{ id: '1:2', name: 'Hero', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 } }] }] };

beforeEach(() => {
  vi.restoreAllMocks();
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
  readToken.mockResolvedValue('figd_secret');
  findNode.mockImplementation(async (_db, { nodeId }) => ({ id: nodeId }));
});

describe('POST /api/v1/projects/:id/figma/frames', () => {
  it('lists the frames of the linked file and marks the one the link points at', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ document })));

    const { res, body } = await call(frames, { url: LINK }, 'u-list');

    expect(res.status).toBe(200);
    expect(body).toEqual({ frames: [{ id: '1:2', name: 'Hero', page: 'Page', width: 400, height: 300 }], selected: '1:2' });
    expect(JSON.stringify(body)).not.toContain('figd_secret');
  });

  it('answers 409 no_token when the user connected no Figma token', async () => {
    readToken.mockResolvedValue(null);

    const { res, body } = await call(frames, { url: LINK }, 'u-none');

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: 'no_token' });
  });

  it('answers 400 for a link that is not a Figma design', async () => {
    const { res, body } = await call(frames, { url: 'https://example.com/x' }, 'u-bad');

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: 'bad_link' });
  });
});

describe('POST /api/v1/projects/:id/figma/import', () => {
  it('places the frames and answers the nodes it made with the undo to replay', async () => {
    importFigmaFrames.mockResolvedValue({ outcome: 'ok', frameIds: ['n1'], undo: [{ u: 1 }], skipped: ['x'] });

    const { res, body } = await call(imports, { canvasId: 'c1', url: LINK, frameIds: ['1:2'], x: 10, y: 20 }, 'u-import');

    expect(res.status).toBe(200);
    expect(body).toEqual({ nodes: [{ id: 'n1' }], undo: [{ u: 1 }], skipped: ['x'] });
    expect(importFigmaFrames).toHaveBeenCalledWith(expect.objectContaining({ url: LINK, nodeIds: ['1:2'], at: { x: 10, y: 20 }, token: 'figd_secret', place: { projectId: 'p1', canvasId: 'c1' } }));
  });

  it('maps a refusal to its status', async () => {
    importFigmaFrames.mockResolvedValue({ outcome: 'token_rejected' });

    const { res, body } = await call(imports, { canvasId: 'c1', url: LINK, x: 0, y: 0 }, 'u-403');

    expect(res.status).toBe(422);
    expect(body).toEqual({ error: 'token_rejected' });
  });

  it('refuses a body without a canvas', async () => {
    const { res } = await call(imports, { url: LINK, x: 0, y: 0 }, 'u-body');

    expect(res.status).toBe(400);
  });
});
