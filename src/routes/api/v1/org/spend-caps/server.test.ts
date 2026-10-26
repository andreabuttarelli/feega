import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';

const resolveOrgCaller = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));

import { GET, PUT } from './+server';

type Handler = (event: unknown) => Promise<Response>;

const member = (role: string) => ({ org_id: 'org-1', user_id: 'user-1', role });
const PROJECT = '22222222-2222-4222-8222-222222222222';

function caller(db: FakeDb) {
  resolveOrgCaller.mockResolvedValue({ caller: { orgId: 'org-1', userId: 'user-1', db: db.db, writeAllowed: true } });
}

async function call(handler: unknown, method: string, body?: unknown) {
  const url = new URL('https://feega.test/api/v1/org/spend-caps');
  const request = new Request(url, { method, headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await (handler as Handler)({ request, url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/api/v1/org/spend-caps', () => {
  it('lists the caps of the org', async () => {
    const fake = fakeDb({ orgs_members: [member('member')], org_spend_caps: [{ org_id: 'org-1', scope: 'org_member', project_id: null, cap_usd: '20', reset: 'monthly' }] }, { filter: true });
    caller(fake);

    const { body } = await call(GET, 'GET');

    expect(body).toEqual({ caps: [{ scope: 'org_member', project_id: null, cap_usd: 20, reset: 'monthly' }] });
  });

  it('an admin sets a cap for one project', async () => {
    const fake = fakeDb({ orgs_members: [member('admin')], org_spend_caps: [] }, { filter: true });
    caller(fake);

    const { res } = await call(PUT, 'PUT', { scope: 'project_total', project_id: PROJECT, cap_usd: 50, reset: 'monthly' });

    expect(res.status).toBe(200);
    expect(fake.calls.find((c) => c.table === 'org_spend_caps' && c.op === 'insert')?.payload).toEqual({ org_id: 'org-1', scope: 'project_total', project_id: PROJECT, cap_usd: 50, reset: 'monthly' });
  });

  it('a null amount removes the cap', async () => {
    const fake = fakeDb({ orgs_members: [member('owner')], org_spend_caps: [] }, { filter: true });
    caller(fake);

    const { res } = await call(PUT, 'PUT', { scope: 'org_member', cap_usd: null });

    expect(res.status).toBe(200);
    expect(fake.calls.some((c) => c.table === 'org_spend_caps' && c.op === 'insert')).toBe(false);
    expect(fake.calls.find((c) => c.table === 'org_spend_caps' && c.op === 'delete')?.filters).toEqual([
      ['org_id', 'org-1'],
      ['scope', 'org_member'],
      ['project_id', null]
    ]);
  });

  it('a member cannot change caps', async () => {
    const fake = fakeDb({ orgs_members: [member('member')], org_spend_caps: [] }, { filter: true });
    caller(fake);

    const { res } = await call(PUT, 'PUT', { scope: 'org_member', cap_usd: 5 });

    expect(res.status).toBe(403);
  });

  it('a project cap needs its project, and an org cap must not have one', async () => {
    const fake = fakeDb({ orgs_members: [member('admin')], org_spend_caps: [] }, { filter: true });
    caller(fake);

    expect((await call(PUT, 'PUT', { scope: 'project_member', cap_usd: 5 })).res.status).toBe(400);
    expect((await call(PUT, 'PUT', { scope: 'org_member', project_id: PROJECT, cap_usd: 5 })).res.status).toBe(400);
    expect((await call(PUT, 'PUT', { scope: 'org_member', cap_usd: -1 })).res.status).toBe(400);
  });
});
