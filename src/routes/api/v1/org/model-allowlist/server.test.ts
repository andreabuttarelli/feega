import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';

const resolveOrgCaller = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));

import { GET, PUT } from './+server';

type Handler = (event: unknown) => Promise<Response>;

const member = (role: string) => ({ org_id: 'org-1', user_id: 'user-1', role });

function caller(db: FakeDb) {
  resolveOrgCaller.mockResolvedValue({ caller: { orgId: 'org-1', userId: 'user-1', db: db.db, writeAllowed: true } });
}

async function call(handler: unknown, method: string, body?: unknown) {
  const url = new URL('https://feega.test/api/v1/org/model-allowlist');
  const request = new Request(url, { method, headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await (handler as Handler)({ request, url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/api/v1/org/model-allowlist', () => {
  it('lists the allowed ids per medium, empty meaning every model', async () => {
    const fake = fakeDb(
      { orgs_members: [member('member')], org_model_allowlist: [{ org_id: 'org-1', medium: 'image', model_id: 'a' }] },
      { filter: true }
    );
    caller(fake);

    const { body } = await call(GET, 'GET');

    expect(body).toEqual({ image: ['a'], video: [], model3d: [] });
  });

  it('an admin replaces the list of one medium', async () => {
    const fake = fakeDb({ orgs_members: [member('admin')], org_model_allowlist: [] }, { filter: true });
    caller(fake);

    const { res } = await call(PUT, 'PUT', { medium: 'video', model_ids: ['v1', 'v2'] });

    expect(res.status).toBe(200);
    expect(fake.calls.find((c) => c.table === 'org_model_allowlist' && c.op === 'delete')?.filters).toEqual([
      ['org_id', 'org-1'],
      ['medium', 'video']
    ]);
    expect(fake.calls.find((c) => c.table === 'org_model_allowlist' && c.op === 'insert')?.payload).toEqual([
      { org_id: 'org-1', medium: 'video', model_id: 'v1' },
      { org_id: 'org-1', medium: 'video', model_id: 'v2' }
    ]);
  });

  it('a plain member cannot write', async () => {
    const fake = fakeDb({ orgs_members: [member('member')], org_model_allowlist: [] }, { filter: true });
    caller(fake);

    const { res } = await call(PUT, 'PUT', { medium: 'video', model_ids: ['v1'] });

    expect(res.status).toBe(403);
    expect(fake.calls.some((c) => c.op === 'delete')).toBe(false);
  });

  it('refuses an unknown medium', async () => {
    const fake = fakeDb({ orgs_members: [member('owner')] }, { filter: true });
    caller(fake);

    expect((await call(PUT, 'PUT', { medium: 'audio', model_ids: [] })).res.status).toBe(400);
  });
});
