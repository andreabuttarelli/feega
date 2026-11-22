import { withOrg } from '$lib/api/client';
import { sendJson, type Sent } from '$lib/dashboard/api';
import type { CloudIntervalName } from '$lib/cloud-pricing';

export enum BillingLinkError {
  NotOwner = 'not_owner',
  NotConfigured = 'not_configured',
  AlreadySubscribed = 'already_subscribed',
  NoCustomer = 'no_customer',
  Unavailable = 'unavailable'
}

export enum BillingBusy {
  Idle = 'idle',
  Checkout = 'checkout',
  Portal = 'portal'
}

export type BillingLinkResult = { url: string; error?: undefined } | { error: BillingLinkError; url?: undefined };

const CHECKOUT_API = '/api/v1/org/billing/checkout';
const PORTAL_API = '/api/v1/org/billing/portal';

const ERROR_OF: Record<string, BillingLinkError> = {
  not_org_owner: BillingLinkError.NotOwner,
  subscriptions_not_configured: BillingLinkError.NotConfigured,
  already_subscribed: BillingLinkError.AlreadySubscribed,
  no_customer: BillingLinkError.NoCustomer
};

function resultOf(sent: Sent): BillingLinkResult {
  if (sent.ok && typeof sent.body.url === 'string') {
    return { url: sent.body.url };
  }
  return { error: ERROR_OF[String(sent.body.error)] ?? BillingLinkError.Unavailable };
}

export async function checkoutLink(interval: CloudIntervalName): Promise<BillingLinkResult> {
  return resultOf(await sendJson(withOrg(CHECKOUT_API), 'POST', { interval }));
}

export async function portalLink(): Promise<BillingLinkResult> {
  return resultOf(await sendJson(withOrg(PORTAL_API), 'POST', {}));
}
