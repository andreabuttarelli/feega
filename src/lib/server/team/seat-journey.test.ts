import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDb, type Row } from '$lib/server/local/memory-db';
import type { Db } from '$lib/server/db/client';

const stripeCalls: unknown[][] = [];
const billed = { quantity: 1 };
vi.mock('$lib/server/stripe', () => ({
  SeatProration: { None: 'none', Invoice: 'always_invoice' },
  seatSubscription: async () => ({ itemId: 'si_1', quantity: billed.quantity, perEditor: true, status: 'active', endsAt: null }),
  setSeatQuantity: async (...args: unknown[]) => {
    stripeCalls.push(['setSeatQuantity', ...args]);
    billed.quantity = args[2] as number;
  }
}));
vi.mock('$lib/server/email', () => ({ sendEmail: async (...args: unknown[]) => stripeCalls.push(['email', (args[0] as { to: string }).to]) }));

import { runTeamOp, TeamOp } from './team';
import { acceptInviteWith } from '$lib/server/tenancy/bootstrap';

const ORG = 'org-1';
const OWNER = 'u-owner';
const NEWCOMER = 'u-new';

function world(subscription: string | null): Db {
  const tables = new Map<string, Row[]>([
    ['orgs', [{ id: ORG, name: 'Acme', slug: 'acme', stripe_subscription_id: subscription }]],
    ['profiles', [{ id: OWNER, email: 'owner@acme.test', name: 'Owner' }, { id: NEWCOMER, email: 'new@acme.test', name: 'New' }]],
    ['orgs_members', [{ id: 'm1', org_id: ORG, user_id: OWNER, role: 'owner', created_at: '2026-01-01' }]],
    ['orgs_invites', []],
    ['credit_ledger', []]
  ]);
  return createMemoryDb({
    tables,
    blobs: new Map(),
    user: { id: OWNER, email: 'owner@acme.test', created_at: '2026-01-01' },
    storageUrl: () => '',
    onChange: () => {}
  }) as unknown as Db;
}

const ctx = (db: Db) => ({ db, userId: OWNER, orgId: ORG, origin: 'https://feega.test', mail: async () => true });

const tokenOf = (url: unknown) => new URL(String(url)).searchParams.values().next().value as string;

beforeEach(() => {
  stripeCalls.length = 0;
  billed.quantity = 1;
});

describe('invite → accept → seat billed', () => {
  it('a paying team bills nothing for the invite, then one more seat when it is accepted', async () => {
    const db = world('sub_1');

    const invited = await runTeamOp(ctx(db), { op: TeamOp.Invite, email: 'new@acme.test', role: 'member' });
    expect(invited.ok).toBe(true);
    expect(stripeCalls).toEqual([]);

    const accepted = await acceptInviteWith(db, { token: tokenOf(invited.ok && invited.data.accept_url), userId: NEWCOMER, email: 'new@acme.test' });

    expect(accepted).toMatchObject({ outcome: 'accepted', role: 'member' });
    expect(stripeCalls).toEqual([['setSeatQuantity', 'sub_1', 'si_1', 2, 'always_invoice'], ['email', 'owner@acme.test']]);
  });

  it('removing that editor bills one seat less', async () => {
    const db = world('sub_1');
    const invited = await runTeamOp(ctx(db), { op: TeamOp.Invite, email: 'new@acme.test', role: 'member' });
    await acceptInviteWith(db, { token: tokenOf(invited.ok && invited.data.accept_url), userId: NEWCOMER, email: 'new@acme.test' });

    await runTeamOp(ctx(db), { op: TeamOp.RemoveMember, userId: NEWCOMER });

    expect(stripeCalls.at(-1)).toEqual(['setSeatQuantity', 'sub_1', 'si_1', 1, 'none']);
  });

  it('re-adding an editor within the period already paid charges nothing', async () => {
    const db = world('sub_1');
    const first = await runTeamOp(ctx(db), { op: TeamOp.Invite, email: 'new@acme.test', role: 'member' });
    await acceptInviteWith(db, { token: tokenOf(first.ok && first.data.accept_url), userId: NEWCOMER, email: 'new@acme.test' });
    await (db as unknown as { from: (t: string) => { update: (v: unknown) => { eq: (c: string, v: unknown) => Promise<unknown> } } }).from('orgs').update({ seats_paid: 2, seats_paid_until: '2099-01-01T00:00:00Z' }).eq('id', ORG);
    await runTeamOp(ctx(db), { op: TeamOp.RemoveMember, userId: NEWCOMER });

    const again = await runTeamOp(ctx(db), { op: TeamOp.Invite, email: 'new@acme.test', role: 'member' });
    stripeCalls.length = 0;
    await acceptInviteWith(db, { token: tokenOf(again.ok && again.data.accept_url), userId: NEWCOMER, email: 'new@acme.test' });

    expect(stripeCalls).toEqual([['setSeatQuantity', 'sub_1', 'si_1', 2, 'none']]);
  });

  it('a free team cannot invite an editor at all', async () => {
    const db = world(null);

    expect(await runTeamOp(ctx(db), { op: TeamOp.Invite, email: 'new@acme.test', role: 'member' })).toMatchObject({ ok: false, refusal: 'seat_limit' });
    expect(stripeCalls).toEqual([]);
  });
});
