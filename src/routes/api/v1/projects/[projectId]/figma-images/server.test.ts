import { describe, it, expect, vi, beforeEach } from 'vitest';

const findReachableProject = vi.fn();
const readToken = vi.fn();
const importCanvasLink = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/figma/token-store', () => ({ figmaTokenStore: () => ({ read: readToken }) }));
vi.mock('$lib/server/canvas/upload', () => ({ importCanvasLink: (...args: unknown[]) => importCanvasLink(...args) }));

const { POST } = await import('./+server');

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
  readToken.mockResolvedValue('figd_secret');
  importCanvasLink.mockResolvedValue({ asset: { id: 'asset-1' } });
});

describe('POST /api/v1/projects/:id/figma-images', () => {
  it('stores the images Figma serves and answers hash to asset, never the token', async () => {
    const figma = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ meta: { images: { [HASH]: 'https://s3.figma.test/a.png' } } })));

    const { res, body } = await call({ fileKey: FILE, hashes: [HASH] }, 'u-ok');

    expect(res.status).toBe(200);
    expect(body).toEqual({ assets: { [HASH]: 'asset-1' } });
    expect(JSON.stringify(body)).not.toContain('figd_secret');
    expect(figma).toHaveBeenCalledWith(`https://api.figma.com/v1/files/${FILE}/images`, { headers: { 'X-Figma-Token': 'figd_secret' } });
    expect(importCanvasLink).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orgId: 'o1', projectId: 'p1', url: 'https://s3.figma.test/a.png', maxBytes: 4 * 1024 * 1024 }));
  });

  it('answers 409 no_token without calling Figma when the user has none', async () => {
    readToken.mockResolvedValue(null);
    const figma = vi.spyOn(globalThis, 'fetch');

    const { res, body } = await call({ fileKey: FILE, hashes: [HASH] }, 'u-none');

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: 'no_token' });
    expect(figma).not.toHaveBeenCalled();
  });

  it('refuses a body that is not a file key and hashes', async () => {
    const { res } = await call({ fileKey: FILE, hashes: [] }, 'u-bad');

    expect(res.status).toBe(400);
  });

  it('answers 422 when Figma rejects the token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 403 }));

    const { res, body } = await call({ fileKey: FILE, hashes: [HASH] }, 'u-403');

    expect(res.status).toBe(422);
    expect(body).toEqual({ error: 'token_rejected' });
  });

  it('rate limits a user who asks too often', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ meta: { images: {} } })));

    const statuses: number[] = [];
    for (let i = 0; i < 13; i++) {
      statuses.push((await call({ fileKey: FILE, hashes: [HASH] }, 'u-busy')).res.status);
    }

    expect(statuses.at(-1)).toBe(429);
    expect(statuses[0]).toBe(200);
  });
});
