import { describe, it, expect, vi, beforeEach } from 'vitest';

const findReachableProject = vi.fn();
const readToken = vi.fn();
const figma = vi.fn();
const importCanvasLink = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/connections/runtime', () => ({ accountFor: () => ({ call: readToken, status: async () => ({ connected: Boolean(await readToken()) }) }) }));
vi.mock('$lib/server/canvas/upload', () => ({ importCanvasLink: (...args: unknown[]) => importCanvasLink(...args) }));

const { POST } = await import('./+server');

const answer = (status: number, data: unknown) => ({ status, data, headers: {}, file: null });

const FILE = 'AbCdEf1234567890';
const HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

type Handler = (event: unknown) => Promise<Response>;

async function call(body: unknown, user = 'u1') {
  const locals = { safeGetSession: async () => ({ user: { id: user } }), db: async () => ({}) };
  const url = new URL('https://feega.test/api/v1/projects/p1/figma-images');
  const request = new Request(url, { method: 'POST', body: JSON.stringify(body) });
  const res = await (POST as unknown as Handler)({ params: { projectId: 'p1' }, locals, request, url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  vi.restoreAllMocks();
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
  readToken.mockResolvedValue(figma);
  importCanvasLink.mockResolvedValue({ asset: { id: 'asset-1' } });
});

describe('POST /api/v1/projects/:id/figma-images', () => {
  it('stores the images Figma serves and answers hash to asset, through the connected account', async () => {
    figma.mockResolvedValue(answer(200, { meta: { images: { [HASH]: 'https://s3.figma.test/a.png' } } }));

    const { res, body } = await call({ fileKey: FILE, hashes: [HASH] }, 'u-ok');

    expect(res.status).toBe(200);
    expect(body).toEqual({ assets: { [HASH]: 'asset-1' } });
    expect(figma).toHaveBeenCalledWith({ endpoint: `https://api.figma.com/v1/files/${FILE}/images` });
    expect(importCanvasLink).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orgId: 'o1', projectId: 'p1', url: 'https://s3.figma.test/a.png', maxBytes: 4 * 1024 * 1024 }));
  });

  it('answers 409 no_token without calling Figma when Figma is not connected', async () => {
    readToken.mockResolvedValue(null);
    figma.mockClear();

    const { res, body } = await call({ fileKey: FILE, hashes: [HASH] }, 'u-none');

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: 'no_token' });
    expect(figma).not.toHaveBeenCalled();
  });

  it('refuses a body that is not a file key and hashes', async () => {
    const { res } = await call({ fileKey: FILE, hashes: [] }, 'u-bad');

    expect(res.status).toBe(400);
  });

  it('answers 422 when Figma rejects the connection', async () => {
    figma.mockResolvedValue(answer(403, {}));

    const { res, body } = await call({ fileKey: FILE, hashes: [HASH] }, 'u-403');

    expect(res.status).toBe(422);
    expect(body).toEqual({ error: 'token_rejected' });
  });

  it('rate limits a user who asks too often', async () => {
    figma.mockResolvedValue(answer(200, { meta: { images: {} } }));

    const statuses: number[] = [];
    for (let i = 0; i < 13; i++) {
      statuses.push((await call({ fileKey: FILE, hashes: [HASH] }, 'u-busy')).res.status);
    }

    expect(statuses.at(-1)).toBe(429);
    expect(statuses[0]).toBe(200);
  });
});
