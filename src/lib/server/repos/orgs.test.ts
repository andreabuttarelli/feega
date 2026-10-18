import { describe, expect, it } from 'vitest';
import { listMemberships } from '$lib/server/repos/orgs';
import { fakeDb } from '$lib/server/db/fake-db';

const USER = '33333333-3333-3333-3333-333333333333';
const OLD = '11111111-1111-1111-1111-111111111111';
const NEW = '22222222-2222-2222-2222-222222222222';

const membership = (orgId: string, createdAt: string, activeOrgId: string | null) => ({
  user_id: USER,
  role: 'owner',
  created_at: createdAt,
  orgs: { id: orgId, name: orgId, slug: orgId },
  profiles: { active_org_id: activeOrgId }
});

describe("l'org attiva è salvata sul profilo", () => {
  it("l'org attiva viene prima, anche se è la più nuova", async () => {
    const { db } = fakeDb({
      orgs_members: [membership(OLD, '2026-01-01T00:00:00Z', NEW), membership(NEW, '2026-05-01T00:00:00Z', NEW)]
    });

    const memberships = await listMemberships(db, USER);

    expect(memberships.map((m) => m.org.id)).toEqual([NEW, OLD]);
  });

  it("senza org attiva, la più vecchia: l'ordine non dipende dal database", async () => {
    const { db } = fakeDb({
      orgs_members: [membership(NEW, '2026-05-01T00:00:00Z', null), membership(OLD, '2026-01-01T00:00:00Z', null)]
    });

    const memberships = await listMemberships(db, USER);

    expect(memberships.map((m) => m.org.id)).toEqual([OLD, NEW]);
  });
});
