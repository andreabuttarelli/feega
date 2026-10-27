import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => [{ orgId: 'org-1' }]) }));
vi.mock('$lib/server/projects/lookup', () => ({
  findReachableProject: vi.fn(async (_db: unknown, input: { projectId: string }) =>
    input.projectId === 'p1' ? { orgId: 'org-1', project: { id: 'p1', brandId: 'b2' } } : null
  )
}));
vi.mock('$lib/server/repos/assets', () => ({ findOrCreateImportedAsset: vi.fn(async () => ({ id: 'asset-logo' })) }));

const { GET } = await import('./+server');

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

const rows = {
  brands: [
    { id: 'b1', org_id: 'org-1', name: 'Acme', slug: 'acme', logo_url: null, short_description: null, content: null },
    { id: 'b2', org_id: 'org-1', name: 'Nord', slug: 'nord', logo_url: 'https://x/logo.png', short_description: null, content: null }
  ],
  posts: [{ id: 'p', org_id: 'org-1', brand_id: 'b1', status: 'ready', planned_for: FUTURE }],
  social_accounts: [{ id: 's', org_id: 'org-1', brand_id: 'b2', status: 'expired' }],
  brand_pins: [
    { org_id: 'org-1', user_id: 'u1', brand_id: 'b1' },
    { org_id: 'org-1', user_id: 'u2', brand_id: 'b2' }
  ]
};

function call(projectId: string, user: object | null = { id: 'u1' }) {
  const { db } = fakeDb(rows, { filter: true });
  const locals = { safeGetSession: async () => ({ user }), db: async () => db };
  return GET({ params: { projectId }, locals } as never);
}

describe('GET agent/brands', () => {
  it('returns each brand with its status and the project brand id', async () => {
    const res = await call('p1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projectBrandId).toBe('b2');
    expect(body.pinned).toEqual(['b1']);
    expect(body.brands.map((b: { id: string; scheduled: number; accounts: number; accountsDown: number }) => [b.id, b.scheduled, b.accounts, b.accountsDown])).toEqual([
      ['b1', 1, 0, 0],
      ['b2', 0, 1, 1]
    ]);
  });

  it('401 without a session, 404 for a project out of reach', async () => {
    expect((await call('p1', null)).status).toBe(401);
    expect((await call('p9')).status).toBe(404);
  });
});
