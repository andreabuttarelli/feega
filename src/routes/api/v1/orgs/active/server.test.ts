import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const member = (orgId: string) => ({
  user_id: 'user-1',
  role: 'member',
  created_at: '2026-01-01T00:00:00Z',
  orgs: { id: orgId, name: orgId, slug: orgId },
  profiles: { active_org_id: null }
});

const { db, calls } = fakeDb({ orgs_members: [member('a'), member('b')], profiles: [] }, { filter: true });

vi.mock('$lib/server/api/bearer-page', () => ({ bearerOf: async () => ({ token: 't', db, user: { id: 'user-1' } }) }));

const { PUT } = await import('./+server');

const put = (body: unknown) =>
  PUT({ request: new Request('http://x/api/v1/orgs/active', { method: 'PUT', body: JSON.stringify(body) }) } as never);

describe('PUT /api/v1/orgs/active', () => {
  it("scrive l'org attiva sul profilo del chiamante", async () => {
    const res = await put({ org_id: 'b' });

    expect(res.status).toBe(200);
    expect(calls.find((c) => c.table === 'profiles' && c.op === 'update')?.payload).toEqual({ active_org_id: 'b' });
  });

  it("un'org altrui risponde 404", async () => {
    expect((await put({ org_id: 'z' })).status).toBe(404);
  });
});
