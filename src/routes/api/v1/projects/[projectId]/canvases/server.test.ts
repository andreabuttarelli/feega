import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasList } from '$lib/api/project-lists';

const USER = { id: 'u1', email: 'ada@x.it' };
vi.mock('$lib/server/db/client', () => ({ createUserDb: () => ({}) }));
vi.mock('$lib/server/nav-cache', () => ({ verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null) }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));

const findReachableProject = vi.fn();
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject }));

const listCanvases = vi.fn();
vi.mock('$lib/server/repos/canvas', async (original) => ({ ...(await original<object>()), listCanvases }));

const { GET } = await import('./+server');

async function get(token: string | null = 'jwt') {
  const url = new URL('https://feega.test/api/v1/projects/p1/canvases');
  const request = new Request(url, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const res = await (GET as (e: unknown) => Promise<Response>)({ request, url, params: { projectId: 'p1' } });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1', name: 'Launch' } });
  listCanvases.mockResolvedValue([{ id: 'c1', projectId: 'p1', name: 'Board', viewport: null }]);
});

describe('GET /api/v1/projects/:id/canvases', () => {
  it('lists the canvases of a reachable project with their page path', async () => {
    const { status, body } = await get();

    expect(status).toBe(200);
    expect(CanvasList.parse(body)).toEqual({ project: { id: 'p1', name: 'Launch' }, canvases: [{ id: 'c1', name: 'Board', path: '/p/p1/c/c1' }] });
    expect(listCanvases).toHaveBeenCalledWith(expect.anything(), { orgId: 'o1', projectId: 'p1' });
  });

  it('answers 404 for a project the user cannot reach', async () => {
    findReachableProject.mockResolvedValue(null);

    expect((await get()).status).toBe(404);
  });

  it('refuses without a bearer', async () => {
    expect((await get(null)).status).toBe(401);
  });
});
