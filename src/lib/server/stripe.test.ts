import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const billingPortalSessionsCreate = vi.fn();
const subscriptionsRetrieve = vi.fn();
const subscriptionsUpdate = vi.fn();
const subscriptionsCancel = vi.fn();
const checkoutSessionsCreate = vi.fn();
const customersCreate = vi.fn();
const pricesList = vi.fn();

vi.mock('$env/dynamic/private', () => ({
	env: {
		STRIPE_SECRET_KEY: 'sk_test_123'
	}
}));

vi.mock('stripe', () => ({
	default: class MockStripe {
		billingPortal = { sessions: { create: billingPortalSessionsCreate } };
		subscriptions = {
			retrieve: subscriptionsRetrieve,
			update: subscriptionsUpdate,
			cancel: subscriptionsCancel
		};
		checkout = { sessions: { create: checkoutSessionsCreate } };
		customers = { create: customersCreate };
		prices = { list: pricesList };
	}
}));

const adminUpdateEq = vi.fn();
const adminUpdate = vi.fn(() => ({ eq: adminUpdateEq }));
const adminFrom = vi.fn(() => ({ update: adminUpdate }));

vi.mock('./supabase-admin', () => ({
	createAdminClient: () => ({ from: adminFrom })
}));

beforeEach(() => {
	vi.resetModules();
	billingPortalSessionsCreate.mockReset();
	subscriptionsRetrieve.mockReset();
	subscriptionsUpdate.mockReset();
	subscriptionsCancel.mockReset();
	checkoutSessionsCreate.mockReset();
	customersCreate.mockReset();
	pricesList.mockReset();
	adminUpdateEq.mockReset().mockResolvedValue({ error: null });
	adminUpdate.mockClear();
	adminFrom.mockClear();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('createBillingPortalSession', () => {
	it('opens the feega portal configuration when one is set', async () => {
		const { env } = await import('$env/dynamic/private');
		(env as Record<string, string>).STRIPE_PORTAL_CONFIGURATION = 'bpc_feega';
		billingPortalSessionsCreate.mockResolvedValue({ url: 'https://portal/feega' });
		const { createBillingPortalSession } = await import('./stripe');

		await createBillingPortalSession({
			customerId: 'cus_1',
			returnUrl: 'https://app/return'
		});

		expect(billingPortalSessionsCreate).toHaveBeenCalledWith({
			customer: 'cus_1',
			return_url: 'https://app/return',
			configuration: 'bpc_feega'
		});
		delete (env as Record<string, string>).STRIPE_PORTAL_CONFIGURATION;
	});

	it('opens the portal home when no flow is requested', async () => {
		billingPortalSessionsCreate.mockResolvedValue({ url: 'https://portal/home' });
		const { createBillingPortalSession } = await import('./stripe');

		const url = await createBillingPortalSession({
			customerId: 'cus_1',
			returnUrl: 'https://app/return'
		});

		expect(url).toBe('https://portal/home');
		expect(billingPortalSessionsCreate).toHaveBeenCalledWith({
			customer: 'cus_1',
			return_url: 'https://app/return'
		});
	});

	it('requests the payment_method_update flow', async () => {
		billingPortalSessionsCreate.mockResolvedValue({ url: 'https://portal/pm' });
		const { createBillingPortalSession } = await import('./stripe');

		await createBillingPortalSession({
			customerId: 'cus_1',
			returnUrl: 'https://app/return',
			flow: 'payment_method'
		});

		expect(billingPortalSessionsCreate).toHaveBeenCalledWith({
			customer: 'cus_1',
			return_url: 'https://app/return',
			flow_data: { type: 'payment_method_update' }
		});
	});
});

describe('applyRetentionCoupon', () => {
	it('applies the coupon to the subscription', async () => {
		const { applyRetentionCoupon } = await import('./stripe');
		await applyRetentionCoupon('sub_1', 'SAVE20');
		// `coupon` was removed from subscription updates in the API version this SDK pins
		// (2026-08-26.dahlia); sending it back would be a 400 "unknown parameter".
		expect(subscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
			discounts: [{ coupon: 'SAVE20' }]
		});
	});
});

describe('cancelSubscriptionAtPeriodEnd', () => {
	it('schedules the cancellation and returns the end date', async () => {
		subscriptionsUpdate.mockResolvedValue({ cancel_at: 1735689600 });
		const { cancelSubscriptionAtPeriodEnd } = await import('./stripe');

		const { endsAt } = await cancelSubscriptionAtPeriodEnd('sub_1', {
			feedback: 'too_expensive',
			comment: 'pricey'
		});

		expect(subscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
			cancel_at_period_end: true,
			cancellation_details: { feedback: 'too_expensive', comment: 'pricey' }
		});
		expect(endsAt).toBe(new Date(1735689600 * 1000).toISOString());
	});

	it('returns null when Stripe reports no cancel_at date', async () => {
		subscriptionsUpdate.mockResolvedValue({ cancel_at: null });
		const { cancelSubscriptionAtPeriodEnd } = await import('./stripe');

		const { endsAt } = await cancelSubscriptionAtPeriodEnd('sub_1', {});
		expect(endsAt).toBeNull();
	});
});

describe('ensureSubscriptionCanceled', () => {
	it('resolves silently when the subscription is already canceled', async () => {
		subscriptionsRetrieve.mockResolvedValue({ status: 'canceled' });
		const { ensureSubscriptionCanceled } = await import('./stripe');
		await expect(ensureSubscriptionCanceled('sub_1')).resolves.toBeUndefined();
	});

	it('throws active_plan when the subscription is still active', async () => {
		subscriptionsRetrieve.mockResolvedValue({ status: 'active' });
		const { ensureSubscriptionCanceled } = await import('./stripe');
		await expect(ensureSubscriptionCanceled('sub_1')).rejects.toThrow('active_plan');
	});

	// The owner used "cancel plan", was told it was cancelled, and Stripe keeps the status
	// `active` until the period runs out. Refusing here left them unable to delete their own
	// brand for up to a month.
	it('lets the delete through once cancellation is scheduled', async () => {
		subscriptionsRetrieve.mockResolvedValue({ status: 'active', cancel_at_period_end: true });
		const { ensureSubscriptionCanceled } = await import('./stripe');
		await expect(ensureSubscriptionCanceled('sub_1')).resolves.toBeUndefined();
	});

	it.each(['incomplete_expired', 'unpaid'])(
		'lets the delete through on the settled status %s',
		async (status) => {
			subscriptionsRetrieve.mockResolvedValue({ status });
			const { ensureSubscriptionCanceled } = await import('./stripe');
			await expect(ensureSubscriptionCanceled('sub_1')).resolves.toBeUndefined();
		}
	);

	// A stale id bills nobody. Refusing on it made the brand undeletable forever.
	it('lets the delete through when Stripe no longer knows the subscription', async () => {
		subscriptionsRetrieve.mockRejectedValue(
			Object.assign(new Error('No such subscription'), { code: 'resource_missing' })
		);
		const { ensureSubscriptionCanceled } = await import('./stripe');
		await expect(ensureSubscriptionCanceled('sub_1')).resolves.toBeUndefined();
	});

	// Failing open on an outage would delete a brand whose subscription is still charging.
	it('refuses when Stripe fails for any other reason', async () => {
		subscriptionsRetrieve.mockRejectedValue(
			Object.assign(new Error('connection error'), { code: 'api_connection_error' })
		);
		const { ensureSubscriptionCanceled } = await import('./stripe');
		await expect(ensureSubscriptionCanceled('sub_1')).rejects.toThrow('connection error');
	});
});

describe('ensureOrgCustomer', () => {
	it('returns the existing customer id without calling Stripe', async () => {
		const { ensureOrgCustomer } = await import('./stripe');
		const id = await ensureOrgCustomer({ id: 'org_1', name: 'Acme', stripe_customer_id: 'cus_existing' });
		expect(id).toBe('cus_existing');
		expect(customersCreate).not.toHaveBeenCalled();
	});

	it('creates a customer tagged with the org id and persists it on orgs', async () => {
		customersCreate.mockResolvedValue({ id: 'cus_new' });
		const { ensureOrgCustomer } = await import('./stripe');

		const id = await ensureOrgCustomer({ id: 'org_1', name: 'Acme', stripe_customer_id: null });

		expect(id).toBe('cus_new');
		expect(customersCreate).toHaveBeenCalledWith({ name: 'Acme', metadata: { org_id: 'org_1' } });
		expect(adminFrom).toHaveBeenCalledWith('orgs');
		expect(adminUpdate).toHaveBeenCalledWith({ stripe_customer_id: 'cus_new' });
		expect(adminUpdateEq).toHaveBeenCalledWith('id', 'org_1');
	});
});

const feegaPrice = (euros: number, id = `price_${euros}`) => ({
	id,
	lookup_key: `feega_monthly_${euros}`,
	unit_amount: euros * 100,
	currency: 'eur'
});

describe('subscriptionPriceId', () => {
	it('resolves the one plan by its lookup key', async () => {
		pricesList.mockResolvedValue({ data: [feegaPrice(9)] });
		const { subscriptionPriceId } = await import('./stripe');

		expect(await subscriptionPriceId()).toBe('price_9');
		expect(pricesList).toHaveBeenCalledWith({ lookup_keys: ['feega_monthly_9'], active: true, limit: 1 });
	});

	it('asks Stripe once, then answers from memory', async () => {
		pricesList.mockResolvedValue({ data: [feegaPrice(9)] });
		const { subscriptionPriceId } = await import('./stripe');

		await subscriptionPriceId();
		await subscriptionPriceId();

		expect(pricesList).toHaveBeenCalledTimes(1);
	});

	it('returns undefined while the price is not in Stripe', async () => {
		pricesList.mockResolvedValue({ data: [] });
		const { subscriptionPriceId } = await import('./stripe');
		expect(await subscriptionPriceId()).toBeUndefined();
	});

	it('refuses a price whose amount disagrees with the plan', async () => {
		pricesList.mockResolvedValue({ data: [{ ...feegaPrice(9), unit_amount: 800 }] });
		const { subscriptionPriceId } = await import('./stripe');
		expect(await subscriptionPriceId()).toBeUndefined();
	});

	it('refuses a price in any currency but euro', async () => {
		pricesList.mockResolvedValue({ data: [{ ...feegaPrice(9), currency: 'usd' }] });
		const { subscriptionPriceId } = await import('./stripe');
		expect(await subscriptionPriceId()).toBeUndefined();
	});

	it('asks again after a failed lookup instead of caching the failure', async () => {
		pricesList.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ data: [feegaPrice(9)] });
		const { subscriptionPriceId } = await import('./stripe');

		await expect(subscriptionPriceId()).rejects.toThrow('down');
		expect(await subscriptionPriceId()).toBe('price_9');
	});
});

describe('subscribedPlan', () => {
	it('reads the plan from the subscription price lookup key', async () => {
		subscriptionsRetrieve.mockResolvedValue({ items: { data: [{ price: { lookup_key: 'feega_monthly_9' } }] } });
		const { subscribedPlan } = await import('./stripe');
		expect(await subscribedPlan('sub_1')).toEqual({ price: 9, credits: 500, lookupKey: 'feega_monthly_9' });
	});

	it('still knows a subscriber on a retired price', async () => {
		subscriptionsRetrieve.mockResolvedValue({ items: { data: [{ price: { lookup_key: 'feega_monthly_64' } }] } });
		const { subscribedPlan } = await import('./stripe');
		expect(await subscribedPlan('sub_1')).toMatchObject({ price: 64, credits: 6400 });
	});

	it('is null for a price that is not a feega plan', async () => {
		subscriptionsRetrieve.mockResolvedValue({ items: { data: [{ price: { lookup_key: 'other_app_pro' } }] } });
		const { subscribedPlan } = await import('./stripe');
		expect(await subscribedPlan('sub_1')).toBeNull();
	});
});

describe('seatSubscription', () => {
	it('reads the per-editor item, its quantity, the status and a scheduled end', async () => {
		subscriptionsRetrieve.mockResolvedValue({
			status: 'active',
			cancel_at: 1735689600,
			items: { data: [{ id: 'si_1', quantity: 3, current_period_end: 1738368000, price: { lookup_key: 'feega_monthly_9' } }] }
		});
		const { seatSubscription } = await import('./stripe');

		expect(await seatSubscription('sub_1')).toEqual({
			itemId: 'si_1',
			quantity: 3,
			perEditor: true,
			status: 'active',
			endsAt: new Date(1735689600 * 1000).toISOString(),
			periodEnd: new Date(1738368000 * 1000).toISOString()
		});
	});

	it('marks a subscription on a retired price as not per editor', async () => {
		subscriptionsRetrieve.mockResolvedValue({ status: 'active', cancel_at: null, items: { data: [{ id: 'si_8', quantity: 1, price: { lookup_key: 'feega_monthly_8' } }] } });
		const { seatSubscription } = await import('./stripe');

		expect(await seatSubscription('sub_1')).toMatchObject({ perEditor: false, endsAt: null });
	});
});

describe('setSeatQuantity', () => {
	it('charges the prorated difference at once when asked to invoice', async () => {
		const { setSeatQuantity, SeatProration } = await import('./stripe');

		await setSeatQuantity('sub_1', 'si_1', 3, SeatProration.Invoice);

		expect(subscriptionsUpdate).toHaveBeenCalledWith('sub_1', { items: [{ id: 'si_1', quantity: 3 }], proration_behavior: 'always_invoice' });
	});

	it('changes the quantity without any proration otherwise', async () => {
		const { setSeatQuantity, SeatProration } = await import('./stripe');

		await setSeatQuantity('sub_1', 'si_1', 2, SeatProration.None);

		expect(subscriptionsUpdate).toHaveBeenCalledWith('sub_1', { items: [{ id: 'si_1', quantity: 2 }], proration_behavior: 'none' });
	});
});

describe('createOneTimeCreditCheckout', () => {
	it('creates a payment-mode session carrying org id and credits in metadata', async () => {
		checkoutSessionsCreate.mockResolvedValue({ url: 'https://checkout/one-time' });
		const { createOneTimeCreditCheckout } = await import('./stripe');

		const url = await createOneTimeCreditCheckout({
			customerId: 'cus_1',
			orgId: 'org_1',
			price: 10,
			credits: 1000,
			successUrl: 'https://app/return?ok=1',
			cancelUrl: 'https://app/return?cancel=1'
		});

		expect(url).toBe('https://checkout/one-time');
		expect(checkoutSessionsCreate).toHaveBeenCalledWith({
			mode: 'payment',
			customer: 'cus_1',
			line_items: [
				{
					price_data: {
						currency: 'eur',
						unit_amount: 1000,
						product_data: { name: '1,000 feega credits' }
					},
					quantity: 1
				}
			],
			success_url: 'https://app/return?ok=1',
			cancel_url: 'https://app/return?cancel=1',
			metadata: { app: 'feega', org_id: 'org_1', credits: '1000' }
		});
	});

	it('throws when Stripe returns no checkout URL', async () => {
		checkoutSessionsCreate.mockResolvedValue({ url: null });
		const { createOneTimeCreditCheckout } = await import('./stripe');

		await expect(
			createOneTimeCreditCheckout({
				customerId: 'cus_1',
				orgId: 'org_1',
				price: 5,
				credits: 350,
				successUrl: 'https://app/return',
				cancelUrl: 'https://app/return'
			})
		).rejects.toThrow('Stripe: no checkout URL');
	});
});

describe('createSubscriptionCheckout', () => {
	it('creates a subscription-mode session on the configured price, tagged for the org', async () => {
		checkoutSessionsCreate.mockResolvedValue({ url: 'https://checkout/sub' });
		const { createSubscriptionCheckout } = await import('./stripe');

		const url = await createSubscriptionCheckout({
			customerId: 'cus_1',
			orgId: 'org_1',
			priceId: 'price_sub_5',
			credits: 500,
			quantity: 3,
			successUrl: 'https://app/return?ok=1',
			cancelUrl: 'https://app/return?cancel=1'
		});

		expect(url).toBe('https://checkout/sub');
		expect(checkoutSessionsCreate).toHaveBeenCalledWith({
			mode: 'subscription',
			customer: 'cus_1',
			line_items: [{ price: 'price_sub_5', quantity: 3 }],
			success_url: 'https://app/return?ok=1',
			cancel_url: 'https://app/return?cancel=1',
			subscription_data: { metadata: { app: 'feega', org_id: 'org_1', credits: '500' } },
			metadata: { app: 'feega', org_id: 'org_1' }
		});
	});

	it('throws when Stripe returns no checkout URL', async () => {
		checkoutSessionsCreate.mockResolvedValue({ url: undefined });
		const { createSubscriptionCheckout } = await import('./stripe');

		await expect(
			createSubscriptionCheckout({
				customerId: 'cus_1',
				orgId: 'org_1',
				priceId: 'price_sub_5',
				credits: 500,
				quantity: 1,
				successUrl: 'https://app/return',
				cancelUrl: 'https://app/return'
			})
		).rejects.toThrow('Stripe: no checkout URL');
	});
});
