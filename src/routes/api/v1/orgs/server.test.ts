import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { FreeOrgLimitReachedError } from '$lib/server/tenancy/free-org-limit';

const { db } = fakeDb({ profiles: [] });
const createFirstOrg = vi.fn();

vi.mock('$lib/server/api/bearer-page', () => ({ bearerOf: async () => ({ token: 't', db, user: { id: 'user-1' } }) }));
vi.mock('$lib/server/tenancy/bootstrap', () => ({ createFirstOrg: (...a: unknown[]) => createFirstOrg(...a) }));

const { POST } = await import('./+server');

const post = (body: unknown) => POST({ request: new Request('http://x/api/v1/orgs', { method: 'POST', body: JSON.stringify(body) }) } as never);

describe('POST /api/v1/orgs', () => {
  it("crea l'org e risponde 201 col suo id", async () => {
    createFirstOrg.mockResolvedValueOnce({ orgId: 'new', slug: 'acme', role: 'owner' });

    const res = await post({ name: 'Acme' });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ org_id: 'new' });
  });

  it('oltre il limite gratuito risponde 402 con la strada per l upgrade', async () => {
    createFirstOrg.mockRejectedValueOnce(new FreeOrgLimitReachedError());

    const res = await post({ name: 'Acme' });

    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: 'free_org_limit_reached', upgrade_path: '/app/credits' });
  });
});
