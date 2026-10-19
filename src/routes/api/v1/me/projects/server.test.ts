import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';
import { ProjectList } from '$lib/api/mobile-contract';

const USER = { id: 'u1', email: 'ada@x.it' };
vi.mock('$lib/server/db/client', () => ({ createUserDb: () => ({}) }));
vi.mock('$lib/server/nav-cache', () => ({ verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null) }));

const listMemberships = vi.fn();
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships }));

const listProjects = vi.fn();
vi.mock('$lib/server/repos/projects', () => ({ listProjects }));

const { GET } = await import('./+server');

const MEMBERSHIPS = [
  { org: { id: 'org-a', name: 'A', slug: 'a' }, role: 'owner' },
  { org: { id: 'org-b', name: 'B', slug: 'b' }, role: 'member' }
];

function project(id: string, mode: ProjectMode) {
  return { id, name: `P ${id}`, slug: id, brandId: null, archivedAt: null, lastActiveAt: '2026-10-19', mode };
}

async function get(query = '', token: string | null = 'jwt') {
  const url = new URL(`https://feega.test/api/v1/me/projects${query}`);
  const request = new Request(url, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const res = await (GET as (e: unknown) => Promise<Response>)({ request, url });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  listMemberships.mockResolvedValue(MEMBERSHIPS);
  listProjects.mockImplementation(async (_db: unknown, orgId: string) => [project(`${orgId}-1`, ProjectMode.Standard), project(`${orgId}-x`, ProjectMode.Uncensored)]);
});

describe('GET /api/v1/me/projects', () => {
  it('lists the standard projects of the active org, in the mobile contract', async () => {
    const { status, body } = await get();

    expect(status).toBe(200);
    expect(ProjectList.parse(body)).toEqual({ org: { id: 'org-a', name: 'A' }, projects: [{ id: 'org-a-1', name: 'P org-a-1', lastActiveAt: '2026-10-19' }] });
  });

  it('follows the org hint when the user is a member', async () => {
    const { body } = await get('?org=org-b');

    expect(body.org.id).toBe('org-b');
  });

  it('ignores an org the user is not a member of', async () => {
    const { body } = await get('?org=stranger');

    expect(body.org.id).toBe('org-a');
  });

  it('answers 404 without an organisation', async () => {
    listMemberships.mockResolvedValue([]);

    expect((await get()).status).toBe(404);
  });

  it('refuses without a bearer', async () => {
    expect((await get('', null)).status).toBe(401);
  });
});
