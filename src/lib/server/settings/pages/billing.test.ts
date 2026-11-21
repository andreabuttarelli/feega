import { beforeEach, describe, expect, it, vi } from 'vitest';

const seatSubscription = vi.fn();

vi.mock('$lib/server/stripe', () => ({
  seatSubscription: (...args: unknown[]) => seatSubscription(...args)
}));

import { BillingPlan } from '$lib/billing-plan';
import { load } from './billing';

type OrgRow = { stripe_subscription_id: string | null; seats_paid: number | null; seats_paid_until: string | null };

function fakeDb(org: OrgRow, memberRoles: string[]) {
  return {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: async (_column: string, roles: string[]) => ({ data: memberRoles.filter((r) => roles.includes(r)).map((role) => ({ role })), error: null }),
        maybeSingle: async () => ({ data: table === 'orgs' ? org : null, error: null })
      };
      return chain;
    }
  };
}

function run(role: string, org: OrgRow, memberRoles: string[]) {
  return load({
    parent: async () => ({ org: { id: 'org-1', name: 'Acme', slug: 'acme', role } }),
    locals: { db: async () => fakeDb(org, memberRoles) }
  } as never);
}

const FREE: OrgRow = { stripe_subscription_id: null, seats_paid: null, seats_paid_until: null };
const CLOUD: OrgRow = { stripe_subscription_id: 'sub_1', seats_paid: 3, seats_paid_until: '2026-12-21T00:00:00.000Z' };
const ROLES = ['owner', 'admin', 'member', 'viewer', 'viewer', 'viewer'];

beforeEach(() => {
  seatSubscription.mockReset();
});

describe('billing settings page load', () => {
  it('shows an org without a subscription as Free, counting only editors', async () => {
    const data = await run('owner', FREE, ROLES);

    expect(data).toMatchObject({ plan: BillingPlan.Free, editors: 3, seatsPaid: 0, renewsAt: null });
    expect(seatSubscription).not.toHaveBeenCalled();
  });

  it('shows a subscribed org as Cloud with paid seats and the renewal date from Stripe', async () => {
    seatSubscription.mockResolvedValue({ itemId: 'si_1', quantity: 3, perEditor: true, status: 'active', endsAt: null, periodEnd: '2026-12-21T00:00:00.000Z' });

    const data = await run('owner', CLOUD, ROLES);

    expect(seatSubscription).toHaveBeenCalledWith('sub_1');
    expect(data).toMatchObject({ plan: BillingPlan.Cloud, editors: 3, seatsPaid: 3, renewsAt: '2026-12-21T00:00:00.000Z', endsAt: null, pastDue: false });
  });

  it('carries a scheduled cancellation and a failed payment', async () => {
    seatSubscription.mockResolvedValue({ itemId: 'si_1', quantity: 3, perEditor: true, status: 'past_due', endsAt: '2027-01-01T00:00:00.000Z', periodEnd: '2026-12-21T00:00:00.000Z' });

    const data = await run('owner', CLOUD, ROLES);

    expect(data).toMatchObject({ endsAt: '2027-01-01T00:00:00.000Z', pastDue: true });
  });

  it('lets only the owner act', async () => {
    expect((await run('owner', FREE, ROLES)).canManage).toBe(true);
    expect((await run('admin', FREE, ROLES)).canManage).toBe(false);
    expect((await run('member', FREE, ROLES)).canManage).toBe(false);
    expect((await run('viewer', FREE, ROLES)).canManage).toBe(false);
  });

  it('still renders Cloud when Stripe is unreachable', async () => {
    seatSubscription.mockRejectedValue(new Error('stripe down'));

    const data = await run('owner', CLOUD, ROLES);

    expect(data).toMatchObject({ plan: BillingPlan.Cloud, renewsAt: '2026-12-21T00:00:00.000Z' });
  });
});
