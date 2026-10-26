import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';

const resolveOrgCaller = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));

import { GET, POST } from './+server';
import { DELETE } from './[id]/+server';

const row = (over: Record<string, unknown> = {}) => ({ id: 'sk-1', org_id: 'org-1', name: 'product-shot', body: 'Studio shot', deleted_at: null, updated_at: 'now', ...over });

type Handler = (event: unknown) => Promise<Response>;

function caller(db: FakeDb, writeAllowed = true) {
  resolveOrgCaller.mockResolvedValue({ caller: { orgId: 'org-1', userId: 'user-1', db: db.db, writeAllowed } });
}

async function call(handler: unknown, method: string, body?: unknown, params: Record<string, string> = {}) {
  const url = new URL('https://feega.test/api/v1/org/prompt-skills');
  const request = new Request(url, { method, headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await (handler as Handler)({ request, url, params });
  return { res, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/api/v1/org/prompt-skills', () => {
  it('lists the live skills of the org', async () => {
    const fake = fakeDb({ prompt_skills: [row()] }, { filter: true });
    caller(fake);

    const { body } = await call(GET, 'GET');

    expect(body.skills).toEqual([{ id: 'sk-1', name: 'product-shot', body: 'Studio shot' }]);
    expect(fake.calls[0].filters).toEqual(expect.arrayContaining([['org_id', 'org-1'], ['deleted_at', null]]));
  });

  it('writes a new skill stamped with org and actor', async () => {
    const fake = fakeDb({ prompt_skills: [] }, { filter: true });
    caller(fake);

    const { res } = await call(POST, 'POST', { name: 'product-shot', body: 'Studio shot' });

    expect(res.status).toBe(201);
    expect(fake.calls.find((c) => c.op === 'insert')!.payload).toMatchObject({ org_id: 'org-1', name: 'product-shot', body: 'Studio shot', actor_id: 'user-1' });
  });

  it('refuses a name that is not kebab-case and an empty body', async () => {
    caller(fakeDb({ prompt_skills: [] }, { filter: true }));

    expect((await call(POST, 'POST', { name: 'Not Kebab', body: 'x' })).res.status).toBe(400);
    expect((await call(POST, 'POST', { name: 'ok', body: '  ' })).res.status).toBe(400);
  });

  it('refuses writes from a read-only key', async () => {
    caller(fakeDb({ prompt_skills: [] }, { filter: true }), false);

    expect((await call(POST, 'POST', { name: 'ok', body: 'x' })).res.status).toBe(403);
  });

  it('deletes a skill softly', async () => {
    const fake = fakeDb({ prompt_skills: [row()] }, { filter: true, mutate: true });
    caller(fake);

    const { res } = await call(DELETE, 'DELETE', undefined, { id: 'sk-1' });

    expect(res.status).toBe(200);
  });
});
