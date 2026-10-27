import { describe, it, expect, vi, beforeEach } from 'vitest';

const findReachableProject = vi.fn();
const readToken = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/figma/token-store', () => ({ figmaTokenStore: () => ({ read: readToken }) }));

const { GET } = await import('./+server');

type Handler = (event: unknown) => Promise<Response>;

async function call() {
  const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => ({}) };
  const url = new URL('https://feega.test/api/v1/projects/p1/figma-token');
  const res = await (GET as unknown as Handler)({ params: { projectId: 'p1' }, locals, request: new Request(url), url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
});

describe('GET /api/v1/projects/:id/figma-token', () => {
  it('says a token is saved, never what it is', async () => {
    readToken.mockResolvedValue('figd_secret');

    const { res, body } = await call();

    expect(res.status).toBe(200);
    expect(body).toEqual({ connected: true });
  });

  it('says none is saved', async () => {
    readToken.mockResolvedValue(null);

    expect((await call()).body).toEqual({ connected: false });
  });
});
