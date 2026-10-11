import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';

const findReachableProject = vi.fn();
const resolveOrgCaller = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args) }));

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));

import { GET, DELETE } from './+server';

const ROW = { project_id: 'p1', org_id: 'o1', login_url: 'https://app.example/login', email: 't@app.example', test_password: 'pw', session: { cookies: [], storage: {} }, session_until: null };

type Handler = (event: unknown) => Promise<Response>;

async function call(handler: unknown, fake: FakeDb | null, headers: Record<string, string> = {}) {
  const locals = { safeGetSession: async () => ({ user: fake ? { id: 'u1' } : null }), db: async () => fake?.db ?? null };
  const url = new URL('https://feega.test/api/v1/projects/p1/app-account');
  const res = await (handler as Handler)({ params: { projectId: 'p1' }, locals, request: new Request(url, { headers }), url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
});

describe('/api/v1/projects/:id/app-account', () => {
  it('shows the remembered test account, never its password', async () => {
    const fake = fakeDb({ app_accounts: [ROW] }, { filter: true });

    const { body } = await call(GET, fake);

    expect(body).toEqual({ account: { loginUrl: ROW.login_url, email: ROW.email, sessionUntil: null } });
    expect(fake.calls[0].filters).toEqual(expect.arrayContaining([['org_id', 'o1'], ['project_id', 'p1']]));
  });

  it('answers null when the project has none', async () => {
    const { body } = await call(GET, fakeDb({ app_accounts: [] }, { filter: true }));

    expect(body).toEqual({ account: null });
  });

  it('forgets the account of the project', async () => {
    const fake = fakeDb({ app_accounts: [ROW] }, { filter: true });

    const { res } = await call(DELETE, fake);

    expect(res.status).toBe(200);
    expect(fake.calls.find((c) => c.op === 'delete')?.filters).toEqual(expect.arrayContaining([['org_id', 'o1'], ['project_id', 'p1']]));
  });

  it('the CLI reaches it with a bearer token, scoped to its org', async () => {
    const fake = fakeDb({ app_accounts: [ROW] }, { filter: true });
    resolveOrgCaller.mockResolvedValue({ caller: { orgId: 'o1', userId: 'u1', db: fake.db, writeAllowed: true } });

    const { body } = await call(GET, null, { authorization: 'Bearer feega_x' });

    expect(body.account).toMatchObject({ email: ROW.email });
    expect(resolveOrgCaller).toHaveBeenCalledWith('feega_x', undefined);
  });

  it('refuses without a session', async () => {
    expect((await call(GET, null)).res.status).toBe(401);
  });

  it('a project out of reach is a 404', async () => {
    findReachableProject.mockResolvedValue(null);

    expect((await call(DELETE, fakeDb({}))).res.status).toBe(404);
  });
});
