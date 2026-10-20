import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const { USER, current } = vi.hoisted(() => ({ USER: { id: 'user-1', email: 'ada@x.it' }, current: { db: null as unknown } }));

vi.mock('$lib/server/db/client', async (original) => ({ ...(await original<object>()), createUserDb: () => current.db }));
vi.mock('$lib/server/nav-cache', async (original) => ({ ...(await original<object>()), verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null) }));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiActionForForm: async () => null }));

const { GET, POST } = await import('./+server');

const ORG = 'org-1';
const PROJECT = 'project-1';

function seed() {
  current.db = fakeDb({
    orgs_members: [{ role: 'owner', orgs: { id: ORG, name: 'Org', slug: 'org' } }],
    projects: [{ id: PROJECT, name: 'Project', slug: 'project', brand_id: null, archived_at: null }],
    influencers: [],
    influencer_views: []
  }).db;
}

function call(handler: typeof GET, page: string, init: RequestInit = {}, query = '', token = 'jwt') {
  const url = new URL(`https://feega.test/api/v1/projects/${PROJECT}/pages/${page}${query}`);
  const request = new Request(url, { ...init, headers: { authorization: `Bearer ${token}` } });
  return handler({ request, url, params: { projectId: PROJECT, page } } as never);
}

describe('project pages over bearer', () => {
  it('loads the influencers page as the page does', async () => {
    seed();
    const res = await call(GET, 'influencers');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ project: { id: PROJECT }, influencers: [] });
  });

  it('runs a page action and keeps its refusal status', async () => {
    seed();
    const res = await call(POST, 'influencers', { method: 'POST', body: new FormData() }, '?action=generate');

    expect(res.status).toBe(400);
  });

  it('an unknown page or action is not found, a bad token is unauthorized', async () => {
    seed();
    expect((await call(GET, 'calendar')).status).toBe(404);
    expect((await call(POST, 'influencers', { method: 'POST', body: new FormData() }, '?action=nope')).status).toBe(404);
    expect((await call(GET, 'influencers', {}, '', 'bad')).status).toBe(401);
  });
});
