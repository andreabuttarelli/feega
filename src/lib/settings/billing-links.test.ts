import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendJson = vi.fn();

vi.mock('$lib/dashboard/api', () => ({
  sendJson: (...args: unknown[]) => sendJson(...args)
}));
vi.mock('$lib/api/client', () => ({
  withOrg: (path: string) => `${path}?org=org-1`
}));

import { BillingLinkError, checkoutLink, portalLink } from './billing-links';

const STRIPE_URL = 'https://checkout.stripe.com/c/pay/cs_test_1';

beforeEach(() => {
  sendJson.mockReset();
});

describe('upgrade to Cloud', () => {
  it('posts the chosen interval to the existing checkout endpoint and returns the Stripe URL', async () => {
    sendJson.mockResolvedValue({ ok: true, status: 200, body: { ok: true, url: STRIPE_URL } });

    const link = await checkoutLink('annual');

    expect(sendJson).toHaveBeenCalledWith('/api/v1/org/billing/checkout?org=org-1', 'POST', { interval: 'annual' });
    expect(link).toEqual({ url: STRIPE_URL });
  });

  it.each([
    ['not_org_owner', BillingLinkError.NotOwner],
    ['subscriptions_not_configured', BillingLinkError.NotConfigured],
    ['already_subscribed', BillingLinkError.AlreadySubscribed],
    ['stripe_unavailable', BillingLinkError.Unavailable],
    ['something_new', BillingLinkError.Unavailable]
  ])('maps the refusal %s to %s', async (code, expected) => {
    sendJson.mockResolvedValue({ ok: false, status: 409, body: { error: code } });

    expect(await checkoutLink('monthly')).toEqual({ error: expected });
  });
});

describe('manage billing', () => {
  it('posts to the existing portal endpoint and returns the Stripe portal URL', async () => {
    sendJson.mockResolvedValue({ ok: true, status: 200, body: { ok: true, url: 'https://billing.stripe.com/p/session/x' } });

    const link = await portalLink();

    expect(sendJson).toHaveBeenCalledWith('/api/v1/org/billing/portal?org=org-1', 'POST', {});
    expect(link).toEqual({ url: 'https://billing.stripe.com/p/session/x' });
  });

  it('says the org has nothing to manage yet when Stripe knows no customer', async () => {
    sendJson.mockResolvedValue({ ok: false, status: 409, body: { error: 'no_customer' } });

    expect(await portalLink()).toEqual({ error: BillingLinkError.NoCustomer });
  });
});
