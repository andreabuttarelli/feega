import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { UncensoredLock } from '$lib/uncensored-lock';
import { ProjectMode } from '$lib/project-mode';

const { USER } = vi.hoisted(() => ({ USER: { id: 'u1', email: 'ada@x.it', user_metadata: {}, created_at: '2020-01-01T00:00:00Z' } }));

const ORG = { id: 'org-a', name: 'Acme', slug: 'acme' };
const PROJECT = { id: 'p1', name: 'Launch', slug: 'launch', brandId: null, archivedAt: null, lastActiveAt: '2026-10-01', mode: ProjectMode.Standard };

vi.mock('$lib/server/db/client', async (original) => ({ ...(await original<object>()), createUserDb: () => fakeDb({}).db }));
vi.mock('$lib/server/nav-cache', async (original) => ({ ...(await original<object>()), verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null) }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => [{ org: ORG, role: 'owner' }]) }));
const findProjectForUser = vi.fn(async (_db: unknown, q: { projectId: string }) => (q.projectId === PROJECT.id ? { orgId: ORG.id, project: PROJECT } : null));
vi.mock('$lib/server/projects/lookup', () => ({ findProjectForUser }));
vi.mock('$lib/server/repos/profiles', async (original) => ({ ...(await original<object>()), ensureProfile: vi.fn(async () => ({ name: 'Ada', email: USER.email, avatarUrl: null })) }));
vi.mock('$lib/server/credits', async (original) => ({ ...(await original<object>()), orgCreditBalance: vi.fn(async () => 42) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ uncensoredLockFor: vi.fn(async () => UncensoredLock.Open) }));
vi.mock('$lib/server/repos/canvas', async (original) => ({ ...(await original<object>()), listCanvases: vi.fn(async () => [{ id: 'c1', name: 'Board' }]) }));
vi.mock('$lib/server/repos/projects', async (original) => ({ ...(await original<object>()), listProjects: vi.fn(async () => [PROJECT]) }));

const { GET } = await import('./+server');

function get(projectId: string, token = 'jwt') {
  const url = new URL(`https://feega.test/api/v1/projects/${projectId}/shell`);
  const cookies = { set: vi.fn(), get: () => undefined, getAll: () => [], delete: vi.fn() };
  const request = new Request(url, { headers: { authorization: `Bearer ${token}` } });
  return { cookies, answer: GET({ request, url, params: { projectId }, cookies } as never) };
}

describe('the project shell over bearer', () => {
  it('answers the same shell the project layout loads, and remembers the project', async () => {
    const { cookies, answer } = get('p1');
    const res = await answer;
    const body = (await res.json()) as { project: { id: string }; canvases: { href: string }[]; creditBalance: number };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ project: { id: 'p1' }, canvases: [{ href: '/p/p1/c/c1' }], creditBalance: 42 });
    expect(cookies.set).toHaveBeenCalledWith(expect.any(String), 'p1', expect.objectContaining({ path: '/' }));
  });

  it('a project that is not yours is not found, and is not remembered', async () => {
    const { cookies, answer } = get('nope');

    expect((await answer).status).toBe(404);
    expect(cookies.set).not.toHaveBeenCalled();
  });

  it('refuses without a valid bearer', async () => {
    expect((await get('p1', 'bad').answer).status).toBe(401);
  });
});
