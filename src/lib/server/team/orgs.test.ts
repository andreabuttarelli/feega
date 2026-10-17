import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { orgsOf, switchOrg, SwitchOutcome } from '$lib/server/team/orgs';

const USER = 'user-1';

const member = (orgId: string, activeOrgId: string | null) => ({
  user_id: USER,
  role: 'owner',
  created_at: '2026-01-01T00:00:00Z',
  orgs: { id: orgId, name: `Org ${orgId}`, slug: orgId },
  profiles: { active_org_id: activeOrgId }
});

describe("cambiare org attiva", () => {
  it("salva l'org scelta sul profilo", async () => {
    const { db, calls } = fakeDb({ orgs_members: [member('a', null), member('b', null)], profiles: [] }, { filter: true });

    expect(await switchOrg(db, { userId: USER, orgId: 'b' })).toBe(SwitchOutcome.Switched);

    const update = calls.find((c) => c.table === 'profiles' && c.op === 'update');
    expect(update?.payload).toEqual({ active_org_id: 'b' });
    expect(update?.filters).toContainEqual(['id', USER]);
  });

  it("un'org di cui non fa parte non diventa attiva", async () => {
    const { db, calls } = fakeDb({ orgs_members: [member('a', null)] }, { filter: true });

    expect(await switchOrg(db, { userId: USER, orgId: 'z' })).toBe(SwitchOutcome.NotMember);
    expect(calls.some((c) => c.op === 'update')).toBe(false);
  });

  it("l'elenco segna quale è attiva", async () => {
    const { db } = fakeDb({ orgs_members: [member('a', 'b'), member('b', 'b')] }, { filter: true });

    const orgs = await orgsOf(db, USER);

    expect(orgs.map((o) => [o.id, o.active])).toEqual([
      ['b', true],
      ['a', false]
    ]);
  });
});
