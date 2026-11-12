import { env } from '$env/dynamic/private';
import Stripe from 'stripe';
import { createAdminClient } from './supabase-admin';
import { PLAN, PLAN_CURRENCY, planForLookupKey, type Plan } from '$lib/credit-ladder';
import { formatCredits } from '$lib/components/credit-amount-format';

let client: Stripe | null = null;

function stripe(): Stripe {
  if (!client) {
    if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    client = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return client;
}

const APP_TAG = 'feega';
const CENTS_PER_UNIT = 100;

let planPriceId: Promise<string | undefined> | null = null;

async function fetchPlanPriceId(): Promise<string | undefined> {
  const { data } = await stripe().prices.list({ lookup_keys: [PLAN.lookupKey], active: true, limit: 1 });

  return data.find((price) => price.currency === PLAN_CURRENCY && price.unit_amount === PLAN.price * CENTS_PER_UNIT)?.id;
}

export async function subscriptionPriceId(): Promise<string | undefined> {
  planPriceId ??= fetchPlanPriceId().catch((e) => {
    planPriceId = null;
    throw e;
  });
  return planPriceId;
}

export async function subscribedPlan(subscriptionId: string): Promise<Plan | null> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  return planForLookupKey(sub.items.data[0]?.price.lookup_key) ?? null;
}

export async function scheduledEnd(subscriptionId: string): Promise<string | null> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  return sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null;
}

export async function setSeatQuantity(subscriptionId: string, quantity: number): Promise<void> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (!item || item.quantity === quantity) {
    return;
  }

  await stripe().subscriptions.update(subscriptionId, {
    items: [{ id: item.id, quantity }],
    proration_behavior: 'always_invoice'
  });
}

/**
 * Billing is org-level (CLAUDE.md: `orgs.stripe_customer_id`, not a brand column) — every brand
 * under the org checks out against the same customer. Written with the service role: this id is a join
 * key another org's session must never set.
 */
export async function ensureOrgCustomer(org: {
  id: string;
  name: string;
  stripe_customer_id: string | null;
}): Promise<string> {
  if (org.stripe_customer_id) return org.stripe_customer_id;

  const customer = await stripe().customers.create({
    name: org.name,
    metadata: { org_id: org.id }
  });
  await createAdminClient().from('orgs').update({ stripe_customer_id: customer.id }).eq('id', org.id);

  return customer.id;
}

export async function createOneTimeCreditCheckout(opts: {
  customerId: string;
  orgId: string;
  price: number;
  credits: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer: opts.customerId,
    line_items: [
      {
        price_data: {
          currency: PLAN_CURRENCY,
          unit_amount: Math.round(opts.price * CENTS_PER_UNIT),
          product_data: { name: `${formatCredits(opts.credits)} feega credits` }
        },
        quantity: 1
      }
    ],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: { app: APP_TAG, org_id: opts.orgId, credits: String(opts.credits) }
  });
  if (!session.url) throw new Error('Stripe: no checkout URL');

  return session.url;
}

export async function createSubscriptionCheckout(opts: {
  customerId: string;
  orgId: string;
  priceId: string;
  credits: number;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: opts.customerId,
    line_items: [{ price: opts.priceId, quantity: opts.quantity }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    subscription_data: { metadata: { app: APP_TAG, org_id: opts.orgId, credits: String(opts.credits) } },
    metadata: { app: APP_TAG, org_id: opts.orgId }
  });
  if (!session.url) throw new Error('Stripe: no checkout URL');

  return session.url;
}

export async function createBillingPortalSession(opts: {
  customerId: string;
  returnUrl: string;
  flow?: 'payment_method';
}): Promise<string> {
  const configuration = env.STRIPE_PORTAL_CONFIGURATION;

  const session = await stripe().billingPortal.sessions.create({
    customer: opts.customerId,
    return_url: opts.returnUrl,
    ...(configuration ? { configuration } : {}),
    ...(opts.flow ? { flow_data: { type: 'payment_method_update' as const } } : {})
  });
  return session.url;
}

export async function applyRetentionCoupon(subscriptionId: string, coupon: string): Promise<void> {
  await stripe().subscriptions.update(subscriptionId, { discounts: [{ coupon }] });
}

export async function cancelSubscriptionAtPeriodEnd(
  subscriptionId: string,
  opts: { feedback?: string; comment?: string }
): Promise<{ endsAt: string | null }> {
  const sub = await stripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
    cancellation_details: {
      feedback: opts.feedback as Stripe.SubscriptionUpdateParams.CancellationDetails.Feedback | undefined,
      comment: opts.comment || undefined
    }
  });
  return { endsAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null };
}

/**
 * States that will never bill again on their own: Stripe has either ended the subscription or
 * given up collecting. `past_due` and `incomplete` stay out — those still recover on a retry, and
 * the owner can end them from the portal in one click.
 */
const SETTLED_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
  'canceled',
  'incomplete_expired',
  'unpaid'
]);

/**
 * Blocks brand deletion while a subscription can still charge someone (deleteBrand maps
 * 'active_plan' to an explicit "cancel your plan first" error) instead of silently canceling it
 * as a side effect.
 *
 * Anything that cannot charge again lets the delete through, including the case the strict
 * `status === 'canceled'` check used to trap: an owner who just used "cancel plan" carries
 * `cancel_at_period_end` with the status still `active`, was told they had cancelled, and could
 * not delete their own brand until the period ran out. A subscription id Stripe no longer knows
 * is treated the same way — it bills nobody, and refusing on it made the brand undeletable
 * forever. Every other Stripe failure (network, auth) still refuses: failing open there would
 * delete a brand whose subscription is very much alive.
 */
export async function ensureSubscriptionCanceled(subscriptionId: string): Promise<void> {
  let sub: Stripe.Subscription;
  try {
    sub = await stripe().subscriptions.retrieve(subscriptionId);
  } catch (e) {
    if ((e as Stripe.errors.StripeError)?.code === 'resource_missing') return;
    throw e;
  }
  if (SETTLED_STATUSES.has(sub.status) || sub.cancel_at_period_end) return;
  throw new Error('active_plan');
}
