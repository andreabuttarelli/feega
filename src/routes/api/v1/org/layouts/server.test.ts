import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';

const resolveOrgCaller = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));

import { GET, POST } from './+server';
import { PATCH, DELETE } from './[id]/+server';

const SPEC = { kind: 'spec', slots: 6, place: { kind: 'ring', radius: 3 } };
const row = (over: Record<string, unknown> = {}) => ({ id: 'lay-1', org_id: 'org-1', name: 'orbit', version: 2, kind: 'spec', spec: SPEC, deleted_at: null, updated_at: 'now', ...over });

type Handler = (event: unknown) => Promise<Response>;

function caller(db: FakeDb) {
  resolveOrgCaller.mockResolvedValue({ caller: { orgId: 'org-1', userId: 'user-1', db: db.db, writeAllowed: true } });
}

async function call(handler: unknown, method: string, body?: unknown, params: Record<string, string> = {}) {
  const url = new URL('https://feega.test/api/v1/org/layouts');
  const request = new Request(url, { method, headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await (handler as Handler)({ request, url, params });
  return { res, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/api/v1/org/layouts', () => {
  it('lists the live layouts of the org', async () => {
    const fake = fakeDb({ layouts: [row()] }, { filter: true });
    caller(fake);

    const { body } = await call(GET, 'GET');

    expect(body.layouts).toEqual([expect.objectContaining({ id: 'lay-1', name: 'orbit', version: 2 })]);
    expect(fake.calls[0].filters).toEqual(expect.arrayContaining([['org_id', 'org-1'], ['deleted_at', null]]));
  });

  it('writes a new spec layout stamped with org and actor', async () => {
    const fake = fakeDb({ layouts: [] }, { filter: true });
    caller(fake);

    const { res } = await call(POST, 'POST', { name: 'orbit', spec: SPEC });

    expect(res.status).toBe(201);
    expect(fake.calls.find((c) => c.op === 'insert')!.payload).toMatchObject({ org_id: 'org-1', name: 'orbit', kind: 'spec', actor_id: 'user-1' });
  });

  it('refuses a spec the interpreter cannot run', async () => {
    caller(fakeDb({ layouts: [] }, { filter: true }));

    const { res, body } = await call(POST, 'POST', { name: 'bad', spec: { ...SPEC, place: { kind: 'spiral' } } });

    expect(res.status).toBe(400);
    expect(body.problems.length).toBeGreaterThan(0);
  });

  it('patches at the expected version and answers conflict on a stale one', async () => {
    const fake = fakeDb({ layouts: [row()] }, { filter: true, mutate: true });
    caller(fake);

    expect((await call(PATCH, 'PATCH', { version: 1, spec: SPEC }, { id: 'lay-1' })).res.status).toBe(409);
    const ok = await call(PATCH, 'PATCH', { version: 2, spec: { ...SPEC, slots: 8 } }, { id: 'lay-1' });
    expect(ok.body.layout.version).toBe(3);
  });

  it('soft deletes', async () => {
    const fake = fakeDb({ layouts: [row()] }, { filter: true });
    caller(fake);

    expect((await call(DELETE, 'DELETE', undefined, { id: 'lay-1' })).res.status).toBe(200);
    expect(fake.calls.find((c) => c.op === 'update')!.payload).toMatchObject({ deleted_at: expect.any(String) });
  });

  it('answers unavailable while the table is not migrated', async () => {
    const unmigrated = { from: () => ({ select: () => ({ eq: () => ({ is: () => ({ order: async () => ({ data: null, error: { code: 'PGRST205' } }) }) }) }) }) };
    resolveOrgCaller.mockResolvedValue({ caller: { orgId: 'org-1', userId: 'user-1', db: unmigrated, writeAllowed: true } });

    expect((await call(GET, 'GET')).body).toEqual({ layouts: [], available: false });
  });
});
