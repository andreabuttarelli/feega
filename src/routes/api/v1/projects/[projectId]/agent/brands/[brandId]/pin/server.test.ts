import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => [{ orgId: 'org-1' }]) }));
vi.mock('$lib/server/projects/lookup', () => ({
  findReachableProject: vi.fn(async (_db: unknown, input: { projectId: string }) => (input.projectId === 'p1' ? { orgId: 'org-1', project: { id: 'p1' } } : null))
}));

const { POST, DELETE } = await import('./+server');

function setup() {
  const fake = fakeDb({ brands: [{ id: 'b1', org_id: 'org-1' }], brand_pins: [] }, { filter: true });
  const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => fake.db };
  const event = (brandId = 'b1') => ({ params: { projectId: 'p1', brandId }, locals }) as never;
  return { fake, event };
}

describe('agent/brands/[brandId]/pin', () => {
  it('POST pins the brand for the signed-in user, in the brand org', async () => {
    const { fake, event } = setup();
    const res = await POST(event());
    expect(res.status).toBe(204);
    const insert = fake.calls.find((c) => c.table === 'brand_pins' && (c.op === 'upsert' || c.op === 'insert'));
    expect(insert?.payload).toEqual({ user_id: 'u1', brand_id: 'b1', org_id: 'org-1' });
  });

  it('DELETE unpins it for that user only', async () => {
    const { fake, event } = setup();
    expect((await DELETE(event())).status).toBe(204);
    const del = fake.calls.find((c) => c.table === 'brand_pins' && c.op === 'delete');
    expect(del?.filters).toEqual(expect.arrayContaining([['user_id', 'u1'], ['brand_id', 'b1']]));
  });

  it('404 for a brand outside the org', async () => {
    const { event } = setup();
    expect((await POST(event('b9'))).status).toBe(404);
  });
});
