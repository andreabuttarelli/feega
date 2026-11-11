import { describe, it, expect, vi, beforeEach } from 'vitest';

const findReachableProject = vi.fn();
const tokensFound = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/code-import/canvas-import', () => ({ tokensFound: (...args: unknown[]) => tokensFound(...args) }));

const route = await import('./+server');

type Handler = (event: unknown) => Promise<Response>;

async function call(query: string) {
  const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => ({}) };
  const url = new URL(`https://feega.test/api/v1/projects/p1/code-import/tokens?${query}`);
  const res = await (route.GET as Handler)({ params: { projectId: 'p1' }, locals, request: new Request(url), url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
});

describe('GET /api/v1/projects/:id/code-import/tokens', () => {
  it('conta i token che il repo o la cartella dichiarano', async () => {
    tokensFound.mockResolvedValue(15);

    const { res, body } = await call('folder=%2Fcode%2Fapp');

    expect(res.status).toBe(200);
    expect(body).toEqual({ tokens: 15 });
    expect(tokensFound.mock.calls[0][1]).toEqual({ folder: '/code/app' });
  });

  it('senza repo né cartella è una richiesta sbagliata', async () => {
    const { res } = await call('');
    expect(res.status).toBe(400);
  });

  it('una sorgente illeggibile risponde zero, non un errore', async () => {
    tokensFound.mockResolvedValue(null);

    const { body } = await call('repo=https%3A%2F%2Fgithub.com%2Fa%2Fb');

    expect(body).toEqual({ tokens: 0 });
  });
});
