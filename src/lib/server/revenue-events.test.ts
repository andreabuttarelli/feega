import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { ProductEvent } from '$lib/server/product-events/track';
import { revenueOf } from './revenue-events';

const FEEGA = { app: 'feega', org_id: 'org-1' };

function sub(quantity: number, extra: object = {}) {
  return { id: 'sub_1', metadata: FEEGA, cancel_at_period_end: false, items: { data: [{ quantity, price: { unit_amount: 2000, currency: 'eur', lookup_key: 'pro_monthly' } }] }, ...extra };
}

const event = (type: string, object: object, previous_attributes?: object) => ({ type, data: { object, previous_attributes } }) as unknown as Stripe.Event;

describe('revenueOf', () => {
  it('una sottoscrizione nuova è un upgrade con importo, valuta, piano e posti', () => {
    expect(revenueOf(event('customer.subscription.created', sub(2)))).toEqual({ orgId: 'org-1', event: ProductEvent.PlanUpgraded, props: { amount: 40, currency: 'eur', plan: 'pro_monthly', seats: 2 } });
  });

  it('meno posti è un downgrade, più posti un upgrade, la disdetta a fine periodo è cancelled', () => {
    expect(revenueOf(event('customer.subscription.updated', sub(1), { items: { data: [{ quantity: 3 }] } }))?.event).toBe(ProductEvent.PlanDowngraded);
    expect(revenueOf(event('customer.subscription.updated', sub(3), { items: { data: [{ quantity: 1 }] } }))?.event).toBe(ProductEvent.PlanUpgraded);
    expect(revenueOf(event('customer.subscription.updated', sub(1, { cancel_at_period_end: true }), { cancel_at_period_end: false }))?.event).toBe(ProductEvent.PlanCancelled);
    expect(revenueOf(event('customer.subscription.updated', sub(1), { metadata: {} }))).toBeNull();
  });

  it('una fattura pagata è ricavo, sul gruppo dell org', () => {
    const invoice = { id: 'in_1', amount_paid: 4000, currency: 'eur', parent: { subscription_details: { metadata: FEEGA } }, lines: { data: [{ pricing: { price_details: { price: 'price_1' } } }] } };

    expect(revenueOf(event('invoice.paid', invoice))).toEqual({ orgId: 'org-1', event: ProductEvent.RevenueRecognized, props: { amount: 40, currency: 'eur', plan: null, invoice_id: 'in_1' } });
  });

  it('un rimborso porta l importo rimborsato', () => {
    const charge = { id: 'ch_1', amount_refunded: 1500, currency: 'eur', metadata: FEEGA };

    expect(revenueOf(event('charge.refunded', charge))?.props).toMatchObject({ amount: 15, charge_id: 'ch_1' });
  });

  it('un oggetto di un altro prodotto sullo stesso account Stripe non conta', () => {
    expect(revenueOf(event('customer.subscription.created', sub(1, { metadata: { app: 'other', org_id: 'x' } })))).toBeNull();
    expect(revenueOf(event('customer.created', {}))).toBeNull();
  });
});
