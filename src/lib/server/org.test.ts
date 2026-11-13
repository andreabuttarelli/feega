import { describe, expect, it, vi } from 'vitest';
import { createTestSupabase } from '$lib/testkit/supabase';
import { ensureOrgForUser, type FirstOrgDeps } from './org';

// `orgs` on the new schema has no owner_id, no plan, no subscription: ownership is
// `orgs_members.role = 'owner'`, and there is no "paying org" preference anymore — billing has
// no home on this schema yet (see credits.ts's module doc). ensureOrgForUser now answers with
// the oldest org the user owns, full stop.

const USER = { id: 'u1', email: 'ana@example.com' } as never;

const THREE_ORGS = [
  { id: 'org-new', created_at: '2026-09-01' },
  { id: 'org-mid', created_at: '2026-05-01' },
  { id: 'org-old', created_at: '2026-01-01' }
];

const memberships = (ownerships: { org_id: string; user_id: string; role?: string }[]) =>
  ownerships.map((m) => ({ role: 'owner', ...m }));

describe('ensureOrgForUser', () => {
  it('always answers with the oldest org when the user owns several', async () => {
    const { client, tables } = createTestSupabase({
      orgs: THREE_ORGS,
      orgs_members: memberships([
        { org_id: 'org-new', user_id: 'u1' },
        { org_id: 'org-mid', user_id: 'u1' },
        { org_id: 'org-old', user_id: 'u1' }
      ])
    });

    const answers = [
      await ensureOrgForUser(client, USER),
      await ensureOrgForUser(client, USER),
      await ensureOrgForUser(client, USER)
    ];

    expect(answers).toEqual(['org-old', 'org-old', 'org-old']);
    expect(tables.get('orgs')).toHaveLength(3);
  });

  it('ignores another user’s org entirely', async () => {
    const { client } = createTestSupabase({
      orgs: [...THREE_ORGS, { id: 'org-theirs', created_at: '2026-01-01' }],
      orgs_members: memberships([
        { org_id: 'org-new', user_id: 'u1' },
        { org_id: 'org-theirs', user_id: 'u2' }
      ])
    });

    expect(await ensureOrgForUser(client, USER)).toBe('org-new');
  });

  it('ignores a membership that is not the owner role', async () => {
    const { client } = createTestSupabase({
      orgs: THREE_ORGS,
      orgs_members: [
        { org_id: 'org-old', user_id: 'u1', role: 'member' },
        { org_id: 'org-mid', user_id: 'u1', role: 'owner' }
      ]
    });

    expect(await ensureOrgForUser(client, USER)).toBe('org-mid');
  });

  it('a user with no org gets one made by the server, never by their own session, and keeps it', async () => {
    const { client, tables } = createTestSupabase({});
    const deps: FirstOrgDeps = {
      createFirstOrg: vi.fn(async ({ userId }) => {
        tables.set('orgs', [{ id: 'org-made', created_at: '2026-11-14' }]);
        tables.set('orgs_members', [{ org_id: 'org-made', user_id: userId, role: 'owner' }]);
        return { orgId: 'org-made', slug: 'ana', role: 'owner' as const };
      })
    };

    const first = await ensureOrgForUser(client, USER, deps);
    const second = await ensureOrgForUser(client, USER, deps);

    expect([first, second]).toEqual(['org-made', 'org-made']);
    expect(deps.createFirstOrg).toHaveBeenCalledTimes(1);
    expect(deps.createFirstOrg).toHaveBeenCalledWith({ userId: 'u1', name: "ana's workspace" });
  });
});
