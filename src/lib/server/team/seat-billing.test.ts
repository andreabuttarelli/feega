import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const setSeatQuantity = vi.fn();
const seatSubscription = vi.fn();
const recorded = vi.fn();
vi.mock('$lib/server/db/client', () => ({
  createServiceRoleDb: () => ({
    from: () => ({ update: (values: unknown) => ({ eq: async (_c: string, id: string) => (recorded(id, values), { error: null }) }) })
  })
}));
vi.mock('$lib/server/stripe', () => ({
  SeatProration: { None: 'none', Invoice: 'always_invoice' },
  setSeatQuantity: (...args: unknown[]) => setSeatQuantity(...args),
  seatSubscription: (...args: unknown[]) => seatSubscription(...args)
}));

import { editorSeatGate, SeatGate, seatSteps, syncSeats, SeatSync } from './seat-billing';

const ORG = 'org-1';
const LATER = '2099-01-01T00:00:00Z';

const team = (org: Record<string, unknown>) =>
  fakeDb(
    {
      orgs: [{ id: ORG, ...org }],
      orgs_members: [
        { org_id: ORG, user_id: 'a', role: 'owner' },
        { org_id: ORG, user_id: 'b', role: 'admin' },
        { org_id: ORG, user_id: 'c', role: 'member' },
        { org_id: ORG, user_id: 'd', role: 'viewer' },
        { org_id: 'other', user_id: 'e', role: 'member' }
      ]
    },
    { filter: true }
  ).db;

const PERIOD_END = '2099-02-01T00:00:00.000Z';
const perEditor = (quantity: number, extra: Record<string, unknown> = {}) => ({ itemId: 'si_1', quantity, perEditor: true, status: 'active', endsAt: null, periodEnd: PERIOD_END, ...extra });

const unreadable = () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'column orgs.seats_paid does not exist' } }) }) }) }) }) as never;

beforeEach(() => {
  setSeatQuantity.mockReset().mockResolvedValue(undefined);
  seatSubscription.mockReset();
  recorded.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('seatSteps — what Stripe is asked to change', () => {
  it.each([
    ['nothing when Stripe already bills the editors', { quantity: 3, paid: 3, editors: 3 }, []],
    ['a removed editor lowers the quantity without any credit: the seat stays paid this period', { quantity: 3, paid: 3, editors: 2 }, [[2, 'none']]],
    ['an editor re-added within the seats paid this period costs nothing', { quantity: 2, paid: 3, editors: 3 }, [[3, 'none']]],
    ['an editor beyond the seats paid this period is charged', { quantity: 3, paid: 3, editors: 4 }, [[4, 'always_invoice']]],
    ['first the paid seats come back free, then only the new one is charged', { quantity: 1, paid: 3, editors: 4 }, [[3, 'none'], [4, 'always_invoice']]]
  ])('%s', (_name, now, steps) => {
    expect(seatSteps(now).map((s) => [s.quantity, s.proration])).toEqual(steps);
  });
});

describe('syncSeats', () => {
  it('charges one more seat when the editors exceed what this period paid for, and records it', async () => {
    seatSubscription.mockResolvedValue(perEditor(2));

    expect(await syncSeats(team({ stripe_subscription_id: 'sub_1', seats_paid: 2, seats_paid_until: PERIOD_END }), ORG)).toBe(SeatSync.Charged);
    expect(setSeatQuantity).toHaveBeenCalledWith('sub_1', 'si_1', 3, 'always_invoice');
    expect(recorded).toHaveBeenCalledWith(ORG, { seats_paid: 3, seats_paid_until: PERIOD_END });
  });

  it('records the seats paid before lowering the quantity, so re-adding this period is free', async () => {
    seatSubscription.mockResolvedValue(perEditor(4));

    await syncSeats(team({ stripe_subscription_id: 'sub_1' }), ORG);

    expect(setSeatQuantity).toHaveBeenCalledWith('sub_1', 'si_1', 3, 'none');
    expect(recorded).toHaveBeenCalledWith(ORG, { seats_paid: 4, seats_paid_until: PERIOD_END });
  });

  it('re-adds within what this period paid for at no charge, whatever order the invoices arrived in', async () => {
    seatSubscription.mockResolvedValue(perEditor(2));

    expect(await syncSeats(team({ stripe_subscription_id: 'sub_1', seats_paid: 3, seats_paid_until: PERIOD_END }), ORG)).toBe(SeatSync.Synced);
    expect(setSeatQuantity).toHaveBeenCalledWith('sub_1', 'si_1', 3, 'none');
  });

  it('a record from an earlier period is not this period: the renewal billed the current quantity', async () => {
    seatSubscription.mockResolvedValue(perEditor(2));

    expect(await syncSeats(team({ stripe_subscription_id: 'sub_1', seats_paid: 3, seats_paid_until: '2099-01-01T00:00:00.000Z' }), ORG)).toBe(SeatSync.Charged);
    expect(setSeatQuantity).toHaveBeenCalledWith('sub_1', 'si_1', 3, 'always_invoice');
  });

  it('never touches a subscription on a retired price', async () => {
    seatSubscription.mockResolvedValue(perEditor(1, { perEditor: false }));

    expect(await syncSeats(team({ stripe_subscription_id: 'sub_legacy' }), ORG)).toBe(SeatSync.Legacy);
    expect(setSeatQuantity).not.toHaveBeenCalled();
  });

  it('never calls Stripe for a team without a subscription', async () => {
    expect(await syncSeats(team({ stripe_subscription_id: null }), ORG)).toBe(SeatSync.Unbilled);
    expect(seatSubscription).not.toHaveBeenCalled();
  });

  it('a Stripe failure never undoes the member change: it reports Failed for the reconcile cron', async () => {
    seatSubscription.mockRejectedValue(new Error('down'));

    expect(await syncSeats(team({ stripe_subscription_id: 'sub_1' }), ORG)).toBe(SeatSync.Failed);
  });

  it('seat state it cannot read is an error, never "no subscription"', async () => {
    await expect(syncSeats(unreadable(), ORG)).rejects.toThrow(/seats_paid/);
  });
});

describe('editorSeatGate — may one more editor be added, and is it charged?', () => {
  it('a free team adds no editor', async () => {
    expect(await editorSeatGate(team({ stripe_subscription_id: null }), ORG)).toBe(SeatGate.Free);
  });

  it('a per-editor team is charged', async () => {
    seatSubscription.mockResolvedValue(perEditor(3));
    expect(await editorSeatGate(team({ stripe_subscription_id: 'sub_1' }), ORG)).toBe(SeatGate.Charged);
  });

  it('a team on a retired per-team price adds editors at no charge', async () => {
    seatSubscription.mockResolvedValue(perEditor(1, { perEditor: false }));
    expect(await editorSeatGate(team({ stripe_subscription_id: 'sub_legacy' }), ORG)).toBe(SeatGate.Included);
  });

  it.each(['past_due', 'unpaid'])('a %s team adds no editor until it pays', async (status) => {
    seatSubscription.mockResolvedValue(perEditor(3, { status }));
    expect(await editorSeatGate(team({ stripe_subscription_id: 'sub_1' }), ORG)).toBe(SeatGate.PastDue);
  });

  it('seat state it cannot read refuses loudly', async () => {
    await expect(editorSeatGate(unreadable(), ORG)).rejects.toThrow();
  });
});
