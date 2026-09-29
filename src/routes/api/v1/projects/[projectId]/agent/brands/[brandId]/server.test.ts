import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => [{ orgId: 'org-1' }]) }));
vi.mock('$lib/server/projects/lookup', () => ({
  findReachableProject: vi.fn(async (_db: unknown, input: { projectId: string }) =>
    input.projectId === 'p1' ? { orgId: 'org-1', project: { id: 'p1' } } : null
  )
}));
vi.mock('$lib/server/brand-colour-asset', () => ({ findOrCreateColourAsset: vi.fn(async () => null) }));

const { GET } = await import('./+server');

const rows = {
  brands: [{ id: 'b1', org_id: 'org-1', website: 'https://acme.example', content: 'instagram:@acme' }],
  social_accounts: [],
  products: []
};

function call(params: { projectId: string; brandId: string }, user: object | null = { id: 'u1' }) {
  const { db } = fakeDb(rows, { filter: true });
  const locals = { safeGetSession: async () => ({ user }), db: async () => db };
  return GET({ params, locals } as never);
}

describe('GET agent/brands/[brandId]', () => {
  it('restituisce i pezzi del brand letti dal database vero del progetto', async () => {
    const res = await call({ projectId: 'p1', brandId: 'b1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      details: { website: 'https://acme.example', colours: [], handles: [{ platform: 'instagram', handle: 'acme' }], stores: [] }
    });
  });

  it('senza sessione 401, progetto altrui 404, brand altrui 404', async () => {
    expect((await call({ projectId: 'p1', brandId: 'b1' }, null)).status).toBe(401);
    expect((await call({ projectId: 'p2', brandId: 'b1' })).status).toBe(404);
    expect((await call({ projectId: 'p1', brandId: 'b9' })).status).toBe(404);
  });
});
