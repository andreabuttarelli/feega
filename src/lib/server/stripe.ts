import { env } from '$env/dynamic/private';
import Stripe from 'stripe';
import { createAdminClient } from './supabase-admin';
import { PLAN, PLAN_CURRENCY, planForLookupKey, type Plan } from '$lib/credit-ladder';
import { CloudInterval, type CloudIntervalName } from '$lib/cloud-pricing';
import { formatCredits } from '$lib/components/credit-amount-format';

let client: Stripe | null = null;

function stripe(): Stripe {
  if (!client) {
    if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    client = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return client;
}

export function readStripeWebhook(body: string, signature: string | null): Stripe.Event | null {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) {
    return null;
  }

  try {
    return stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return null;
  }
}

const APP_TAG = 'feega';
const CENTS_PER_UNIT = 100;

let planPriceId: Promise<string | undefined> | null = null;

async function fetchPlanPriceId(): Promise<string | undefined> {
  const { data } = await stripe().prices.list({ lookup_keys: [PLAN.lookupKey], active: true, limit: 1 });

  return data.find((price) => price.currency === PLAN_CURRENCY && price.unit_amount === PLAN.price * CENTS_PER_UNIT)?.id;
}

const CLOUD_PRICE_ENV: Record<CloudIntervalName, () => string | undefined> = {
  [CloudInterval.Monthly]: () => env.STRIPE_PRICE_CLOUD_MONTHLY,
  [CloudInterval.Annual]: () => env.STRIPE_PRICE_CLOUD_ANNUAL
};

export function cloudPriceId(interval: CloudIntervalName): string | undefined {
  return CLOUD_PRICE_ENV[interval]() || undefined;
}

const isCloudPrice = (priceId: string): boolean => Object.values(CloudInterval).some((interval) => !!priceId && cloudPriceId(interval) === priceId);

const isPerEditor = (price: { id: string; lookup_key: string | null }): boolean => price.lookup_key === PLAN.lookupKey || isCloudPrice(price.id);

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

export enum SeatProration {
  None = 'none',
  Invoice = 'always_invoice'
}

const INTERVAL_OF_STRIPE: Record<string, CloudInterval> = { month: CloudInterval.Monthly, year: CloudInterval.Annual };

export type SeatSubscription = { itemId: string; quantity: number; perEditor: boolean; status: string; endsAt: string | null; periodEnd: string | null; interval: CloudInterval | null };

export async function seatSubscription(subscriptionId: string): Promise<SeatSubscription | null> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const items = sub.items.data;
  const item = items.find((i) => isPerEditor(i.price)) ?? items[0];
  if (!item) {
    return null;
  }

  return {
    itemId: item.id,
    quantity: item.quantity ?? 1,
    perEditor: isPerEditor(item.price),
    interval: INTERVAL_OF_STRIPE[item.price.recurring?.interval ?? ''] ?? null,
    status: sub.status,
    endsAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
    periodEnd: item.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null
  };
}

const CLOUD_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing']);

export async function cloudSubscriptionActive(subscriptionId: string): Promise<boolean> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);

  return CLOUD_STATUSES.has(sub.status) && sub.items.data.some((item) => isCloudPrice(item.price.id));
}

export async function setSeatQuantity(subscriptionId: string, itemId: string, quantity: number, proration: SeatProration): Promise<void> {
  await stripe().subscriptions.update(subscriptionId, { items: [{ id: itemId, quantity }], proration_behavior: proration });
}

/**
 * Billing is org-level (CLAUDE.md: `orgs.stripe_customer_id`, not a brand column) — every brand
 * under the org checks out against the same customer. Written with the service role: this id is a join
 * key another org's session must never set.
 */
async function fillMissingEmail(customerId: string, email: string | undefined): Promise<void> {
  if (!email) {
    return;
  }

  const customer = await stripe().customers.retrieve(customerId);
  if (customer.deleted || customer.email) {
    return;
  }

  await stripe().customers.update(customerId, { email });
}

export async function ensureOrgCustomer(
  org: {
    id: string;
    name: string;
    stripe_customer_id: string | null;
  },
  email: string | undefined
): Promise<string> {
  if (org.stripe_customer_id) {
    await fillMissingEmail(org.stripe_customer_id, email);
    return org.stripe_customer_id;
  }

  const customer = await stripe().customers.create({
    email,
    name: org.name,
    metadata: { org_id: org.id, app: APP_TAG }
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
          product_data: { name: `${formatCredits(opts.credits)} Feega credits` }
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
