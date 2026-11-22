import { beforeEach, describe, expect, it, vi } from 'vitest';

const stripe = vi.hoisted(() => ({ active: vi.fn(async (_subscriptionId: string) => true) }));

vi.mock('$lib/server/stripe', () => ({ cloudSubscriptionActive: stripe.active }));

import { orgHasCloud } from './cloud-entitlement';

const dbWith = (org: { stripe_subscription_id: string | null } | null) =>
  ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: org }) }) }) }) }) as never;

beforeEach(() => {
  stripe.active.mockReset();
  stripe.active.mockResolvedValue(true);
});

describe('orgHasCloud', () => {
  it('asks Stripe about the subscription of the org', async () => {
    expect(await orgHasCloud(dbWith({ stripe_subscription_id: 'sub_1' }), 'org-1')).toBe(true);
    expect(stripe.active).toHaveBeenCalledWith('sub_1');
  });

  it('is false when Stripe says the subscription is not an active Cloud plan', async () => {
    stripe.active.mockResolvedValue(false);

    expect(await orgHasCloud(dbWith({ stripe_subscription_id: 'sub_1' }), 'org-1')).toBe(false);
  });

  it('is false for an org that never subscribed, without calling Stripe', async () => {
    expect(await orgHasCloud(dbWith({ stripe_subscription_id: null }), 'org-1')).toBe(false);
    expect(await orgHasCloud(dbWith(null), 'org-1')).toBe(false);
    expect(stripe.active).not.toHaveBeenCalled();
  });
});
