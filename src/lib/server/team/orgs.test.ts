import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { FreeOrgLimitReachedError } from '$lib/server/tenancy/free-org-limit';
import { createOrg, CreateOutcome, orgsOf, switchOrg, SwitchOutcome } from '$lib/server/team/orgs';

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

describe('nuova organizzazione', () => {
  it("la crea con chi la chiede come owner e la rende attiva", async () => {
    const { db, calls } = fakeDb({ profiles: [] });
    const createFirstOrg = vi.fn(async () => ({ orgId: 'new', slug: 'acme-1', role: 'owner' as const }));

    const created = await createOrg(db, { createFirstOrg }, { userId: USER, name: '  Acme  ' });

    expect(created).toEqual({ outcome: CreateOutcome.Created, orgId: 'new' });
    expect(createFirstOrg).toHaveBeenCalledWith({ userId: USER, name: 'Acme' });
    expect(calls.find((c) => c.table === 'profiles' && c.op === 'update')?.payload).toEqual({ active_org_id: 'new' });
  });

  it('oltre il limite di org gratuite non la crea, e lo dice', async () => {
    const { db } = fakeDb({});
    const createFirstOrg = vi.fn(async () => {
      throw new FreeOrgLimitReachedError();
    });

    expect(await createOrg(db, { createFirstOrg }, { userId: USER, name: 'Acme' })).toEqual({ outcome: CreateOutcome.FreeLimit });
  });

  it('un nome vuoto non crea niente', async () => {
    const createFirstOrg = vi.fn();

    expect(await createOrg(fakeDb({}).db, { createFirstOrg }, { userId: USER, name: '   ' })).toEqual({ outcome: CreateOutcome.InvalidName });
    expect(createFirstOrg).not.toHaveBeenCalled();
  });
});
