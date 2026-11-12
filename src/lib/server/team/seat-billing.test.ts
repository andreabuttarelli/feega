import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const setSeatQuantity = vi.fn();
vi.mock('$lib/server/stripe', () => ({ setSeatQuantity: (...args: unknown[]) => setSeatQuantity(...args) }));

import { syncSeats, SeatSync } from './seat-billing';

const ORG = 'org-1';

const team = (subscription: string | null) =>
  fakeDb(
    {
      orgs: [{ id: ORG, stripe_subscription_id: subscription }],
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

beforeEach(() => {
  setSeatQuantity.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('syncSeats', () => {
  it('bills one seat per human editor of this team; viewers and other teams do not count', async () => {
    expect(await syncSeats(team('sub_1'), ORG)).toBe(SeatSync.Synced);
    expect(setSeatQuantity).toHaveBeenCalledWith('sub_1', 3);
  });

  it('never calls Stripe for a team without a subscription', async () => {
    expect(await syncSeats(team(null), ORG)).toBe(SeatSync.Unbilled);
    expect(setSeatQuantity).not.toHaveBeenCalled();
  });

  it('a Stripe failure never undoes the member change: it reports Failed for the reconcile cron', async () => {
    setSeatQuantity.mockRejectedValue(new Error('down'));

    expect(await syncSeats(team('sub_1'), ORG)).toBe(SeatSync.Failed);
  });
});
