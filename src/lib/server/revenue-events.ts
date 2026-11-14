import type Stripe from 'stripe';
import { ProductEvent, type Money, type ProductProps } from '$lib/server/product-events/track';

const APP_TAG = 'feega';
const CENTS_PER_UNIT = 100;

type RevenueEvent = ProductEvent.PlanUpgraded | ProductEvent.PlanDowngraded | ProductEvent.PlanCancelled | ProductEvent.RevenueRecognized | ProductEvent.RevenueRefunded;

export type Revenue = { [E in RevenueEvent]: { orgId: string; event: E; props: ProductProps[E] } }[RevenueEvent];

type Tagged = { metadata?: Record<string, string> | null };
type Item = { quantity?: number | null; price?: { unit_amount?: number | null; currency?: string; lookup_key?: string | null } };
type Sub = Tagged & { cancel_at_period_end?: boolean; items: { data: Item[] } };
type PreviousSub = { cancel_at_period_end?: boolean; items?: { data: { quantity?: number | null }[] } };
type Invoice = Tagged & { id: string; amount_paid: number; currency: string; parent?: { subscription_details?: Tagged | null } | null };
type Charge = Tagged & { id: string; amount_refunded: number; currency: string };

const units = (cents: number) => cents / CENTS_PER_UNIT;

function feegaOrg(tagged: Tagged | null | undefined): string | null {
  const meta = tagged?.metadata;
  return meta?.app === APP_TAG && meta.org_id ? meta.org_id : null;
}

function subMoney(sub: Sub): Money & { seats: number } {
  const item = sub.items.data[0];
  const seats = item?.quantity ?? 1;
  return { amount: units((item?.price?.unit_amount ?? 0) * seats), currency: item?.price?.currency ?? '', plan: item?.price?.lookup_key ?? null, seats };
}

function subChange(sub: Sub, before: PreviousSub | undefined): RevenueEvent | null {
  if (sub.cancel_at_period_end && before?.cancel_at_period_end === false) {
    return ProductEvent.PlanCancelled;
  }

  const was = before?.items?.data[0]?.quantity;
  const now = sub.items.data[0]?.quantity ?? 1;
  if (was === undefined || was === null || was === now) {
    return null;
  }
  return now > was ? ProductEvent.PlanUpgraded : ProductEvent.PlanDowngraded;
}

function fromSubscription(sub: Sub, event: RevenueEvent | null): Revenue | null {
  const orgId = feegaOrg(sub);
  if (!orgId || !event) {
    return null;
  }

  const { seats, ...money } = subMoney(sub);
  return event === ProductEvent.PlanCancelled ? { orgId, event, props: money } : { orgId, event: event as ProductEvent.PlanUpgraded, props: { ...money, seats } };
}

function fromInvoice(invoice: Invoice): Revenue | null {
  const orgId = feegaOrg(invoice.parent?.subscription_details) ?? feegaOrg(invoice);
  if (!orgId) {
    return null;
  }
  return { orgId, event: ProductEvent.RevenueRecognized, props: { amount: units(invoice.amount_paid), currency: invoice.currency, plan: null, invoice_id: invoice.id } };
}

function fromCharge(charge: Charge): Revenue | null {
  const orgId = feegaOrg(charge);
  if (!orgId) {
    return null;
  }
  return { orgId, event: ProductEvent.RevenueRefunded, props: { amount: units(charge.amount_refunded), currency: charge.currency, plan: null, charge_id: charge.id } };
}

const READERS: Record<string, (object: unknown, previous: unknown) => Revenue | null> = {
  'customer.subscription.created': (o) => fromSubscription(o as Sub, ProductEvent.PlanUpgraded),
  'customer.subscription.updated': (o, p) => fromSubscription(o as Sub, subChange(o as Sub, p as PreviousSub | undefined)),
  'customer.subscription.deleted': (o) => fromSubscription(o as Sub, ProductEvent.PlanCancelled),
  'invoice.paid': (o) => fromInvoice(o as Invoice),
  'charge.refunded': (o) => fromCharge(o as Charge)
};

export function revenueOf(event: Stripe.Event): Revenue | null {
  const data = event.data as { object: unknown; previous_attributes?: unknown };
  return READERS[event.type]?.(data.object, data.previous_attributes) ?? null;
}
