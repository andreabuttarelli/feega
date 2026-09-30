import { env } from '$env/dynamic/private';
import Stripe from 'stripe';
import { createAdminClient } from './supabase-admin';
import { CREDIT_LADDER, PLAN_CURRENCY, rungForLookupKey } from '$lib/credit-ladder';
import { DISPLAY_UNITS_PER_CREDIT } from '$lib/components/credit-amount-format';
import type { PaymentRef } from './refund-status';

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

const WITHDRAWAL_CONSENT = {
  consent_collection: { terms_of_service: 'required' as const },
  custom_text: {
    terms_of_service_acceptance: {
      message:
        'I agree to the [Terms](https://feega.app/terms) and the [Refund Policy](https://feega.app/refunds). I ask feega to supply the credits and the service immediately, and I acknowledge that I lose my 14-day right of withdrawal to the extent I use the credits.'
    },
    submit: {
      message:
        'Refundable within 14 days while you have used no more than 10% of the credits, up to 5 credits. Payment processing fees are not refunded.'
    }
  }
};

let rungPriceIds: Promise<Map<number, string>> | null = null;

async function fetchRungPriceIds(): Promise<Map<number, string>> {
  const { data } = await stripe().prices.list({
    lookup_keys: CREDIT_LADDER.map((rung) => rung.lookupKey),
    active: true,
    limit: 100
  });

  const ids = new Map<number, string>();
  for (const price of data) {
    const rung = rungForLookupKey(price.lookup_key);
    if (!rung || price.currency !== PLAN_CURRENCY || price.unit_amount !== rung.price * CENTS_PER_UNIT) {
      continue;
    }
    ids.set(rung.price, price.id);
  }
  return ids;
}

export async function subscriptionPriceIdFor(rungPrice: number): Promise<string | undefined> {
  rungPriceIds ??= fetchRungPriceIds().catch((e) => {
    rungPriceIds = null;
    throw e;
  });
  return (await rungPriceIds).get(rungPrice);
}

export async function subscribedRungPrice(subscriptionId: string): Promise<number | null> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  return rungForLookupKey(sub.items.data[0]?.price.lookup_key)?.price ?? null;
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
          product_data: { name: `${opts.credits / DISPLAY_UNITS_PER_CREDIT} feega credits` }
        },
        quantity: 1
      }
    ],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: { app: APP_TAG, org_id: opts.orgId, credits: String(opts.credits) },
    ...WITHDRAWAL_CONSENT
  });
  if (!session.url) throw new Error('Stripe: no checkout URL');

  return session.url;
}

export async function createSubscriptionCheckout(opts: {
  customerId: string;
  orgId: string;
  priceId: string;
  credits: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: opts.customerId,
    line_items: [{ price: opts.priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    subscription_data: { metadata: { app: APP_TAG, org_id: opts.orgId, credits: String(opts.credits) } },
    metadata: { app: APP_TAG, org_id: opts.orgId },
    ...WITHDRAWAL_CONSENT
  });
  if (!session.url) throw new Error('Stripe: no checkout URL');

  return session.url;
}

/**
 * Every plan CHANGE happens inside Stripe's hosted portal, on the prices configured there — the
 * app names a price only to open the first subscription.
 */
export async function createBillingPortalSession(opts: {
  customerId: string;
  returnUrl: string;
  flow?: 'payment_method' | 'upgrade';
  subscriptionId: string | null;
}): Promise<string> {
  const flow_data =
    opts.flow === 'payment_method'
      ? { type: 'payment_method_update' as const }
      : opts.flow === 'upgrade' && opts.subscriptionId
        ? {
            type: 'subscription_update' as const,
            subscription_update: { subscription: opts.subscriptionId }
          }
        : undefined;

  const configuration = env.STRIPE_PORTAL_CONFIGURATION;

  const session = await stripe().billingPortal.sessions.create({
    customer: opts.customerId,
    return_url: opts.returnUrl,
    ...(configuration ? { configuration } : {}),
    ...(flow_data ? { flow_data } : {})
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

const CHARGE_FEE_PATH = 'payment_intent.latest_charge.balance_transaction';

function feeOfIntent(intent: string | Stripe.PaymentIntent | null | undefined): number {
  if (!intent || typeof intent === 'string') {
    return 0;
  }

  const charge = intent.latest_charge;
  if (!charge || typeof charge === 'string') {
    return 0;
  }

  const transaction = charge.balance_transaction;
  return transaction && typeof transaction !== 'string' ? transaction.fee : 0;
}

export async function paymentProcessingFee(payment: PaymentRef): Promise<number> {
  if (payment.checkoutId) {
    const session = await stripe().checkout.sessions.retrieve(payment.checkoutId, { expand: [CHARGE_FEE_PATH] });
    return feeOfIntent(session.payment_intent) / CENTS_PER_UNIT;
  }
  if (!payment.invoiceId) {
    return 0;
  }

  const { data } = await stripe().invoicePayments.list({
    invoice: payment.invoiceId,
    expand: [`data.payment.${CHARGE_FEE_PATH}`]
  });
  const cents = data.reduce((sum, row) => sum + feeOfIntent(row.payment.payment_intent), 0);
  return cents / CENTS_PER_UNIT;
}
