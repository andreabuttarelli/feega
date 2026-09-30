import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const billingPortalSessionsCreate = vi.fn();
const subscriptionsRetrieve = vi.fn();
const subscriptionsUpdate = vi.fn();
const subscriptionsCancel = vi.fn();
const checkoutSessionsCreate = vi.fn();
const checkoutSessionsRetrieve = vi.fn();
const invoicePaymentsList = vi.fn();
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
		checkout = { sessions: { create: checkoutSessionsCreate, retrieve: checkoutSessionsRetrieve } };
		invoicePayments = { list: invoicePaymentsList };
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
	checkoutSessionsRetrieve.mockReset();
	invoicePaymentsList.mockReset();
	customersCreate.mockReset();
	pricesList.mockReset();
	adminUpdateEq.mockReset().mockResolvedValue({ error: null });
	adminUpdate.mockClear();
	adminFrom.mockClear();
});

afterEach(() => {
	vi.clearAllMocks();
});

const withdrawalConsent = {
	consent_collection: { terms_of_service: 'required' },
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

describe('createBillingPortalSession', () => {
	it('opens the feega portal configuration when one is set', async () => {
		const { env } = await import('$env/dynamic/private');
		(env as Record<string, string>).STRIPE_PORTAL_CONFIGURATION = 'bpc_feega';
		billingPortalSessionsCreate.mockResolvedValue({ url: 'https://portal/feega' });
		const { createBillingPortalSession } = await import('./stripe');

		await createBillingPortalSession({
			customerId: 'cus_1',
			returnUrl: 'https://app/return',
			flow: undefined,
			subscriptionId: 'sub_1'
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
			returnUrl: 'https://app/return',
			flow: undefined,
			subscriptionId: 'sub_1'
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
			flow: 'payment_method',
			subscriptionId: 'sub_1'
		});

		expect(billingPortalSessionsCreate).toHaveBeenCalledWith({
			customer: 'cus_1',
			return_url: 'https://app/return',
			flow_data: { type: 'payment_method_update' }
		});
	});

	it('sends an upgrade to the portal to pick the plan, naming no price', async () => {
		billingPortalSessionsCreate.mockResolvedValue({ url: 'https://portal/upgrade' });
		const { createBillingPortalSession } = await import('./stripe');

		await createBillingPortalSession({
			customerId: 'cus_1',
			returnUrl: 'https://app/return',
			flow: 'upgrade',
			subscriptionId: 'sub_1'
		});

		expect(billingPortalSessionsCreate).toHaveBeenCalledWith({
			customer: 'cus_1',
			return_url: 'https://app/return',
			flow_data: { type: 'subscription_update', subscription_update: { subscription: 'sub_1' } }
		});
		expect(subscriptionsRetrieve).not.toHaveBeenCalled();
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

const feegaPrice = (usd: number, id = `price_${usd}`) => ({
	id,
	lookup_key: `feega_monthly_${usd}`,
	unit_amount: usd * 100,
	currency: 'eur'
});

describe('subscriptionPriceIdFor', () => {
	it('resolves a rung by its lookup key', async () => {
		pricesList.mockResolvedValue({ data: [feegaPrice(8), feegaPrice(16)] });
		const { subscriptionPriceIdFor } = await import('./stripe');

		expect(await subscriptionPriceIdFor(8)).toBe('price_8');
		expect(await subscriptionPriceIdFor(16)).toBe('price_16');
		expect(pricesList).toHaveBeenCalledWith({
			lookup_keys: [
				'feega_monthly_8',
				'feega_monthly_16',
				'feega_monthly_32',
				'feega_monthly_64',
				'feega_monthly_128',
				'feega_monthly_256'
			],
			active: true,
			limit: 100
		});
	});

	it('asks Stripe once, then answers from memory', async () => {
		pricesList.mockResolvedValue({ data: [feegaPrice(8)] });
		const { subscriptionPriceIdFor } = await import('./stripe');

		await subscriptionPriceIdFor(8);
		await subscriptionPriceIdFor(8);

		expect(pricesList).toHaveBeenCalledTimes(1);
	});

	it('returns undefined for a rung whose price is not in Stripe', async () => {
		pricesList.mockResolvedValue({ data: [feegaPrice(8)] });
		const { subscriptionPriceIdFor } = await import('./stripe');
		expect(await subscriptionPriceIdFor(32)).toBeUndefined();
	});

	it('refuses a price whose amount disagrees with the rung', async () => {
		pricesList.mockResolvedValue({ data: [{ ...feegaPrice(8), unit_amount: 900 }] });
		const { subscriptionPriceIdFor } = await import('./stripe');
		expect(await subscriptionPriceIdFor(8)).toBeUndefined();
	});

	it('refuses a price in any currency but euro', async () => {
		pricesList.mockResolvedValue({ data: [{ ...feegaPrice(8), currency: 'usd' }] });
		const { subscriptionPriceIdFor } = await import('./stripe');
		expect(await subscriptionPriceIdFor(8)).toBeUndefined();
	});

	it('asks again after a failed lookup instead of caching the failure', async () => {
		pricesList.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ data: [feegaPrice(8)] });
		const { subscriptionPriceIdFor } = await import('./stripe');

		await expect(subscriptionPriceIdFor(8)).rejects.toThrow('down');
		expect(await subscriptionPriceIdFor(8)).toBe('price_8');
	});
});

describe('subscribedRungPrice', () => {
	it('reads the tier from the subscription price lookup key', async () => {
		subscriptionsRetrieve.mockResolvedValue({ items: { data: [{ price: { lookup_key: 'feega_monthly_64' } }] } });
		const { subscribedRungPrice } = await import('./stripe');
		expect(await subscribedRungPrice('sub_1')).toBe(64);
	});

	it('is null for a price that is not a feega tier', async () => {
		subscriptionsRetrieve.mockResolvedValue({ items: { data: [{ price: { lookup_key: 'other_app_pro' } }] } });
		const { subscribedRungPrice } = await import('./stripe');
		expect(await subscribedRungPrice('sub_1')).toBeNull();
	});
});

describe('createOneTimeCreditCheckout', () => {
	it('creates a payment-mode session carrying org id and credits in metadata', async () => {
		checkoutSessionsCreate.mockResolvedValue({ url: 'https://checkout/one-time' });
		const { createOneTimeCreditCheckout } = await import('./stripe');

		const url = await createOneTimeCreditCheckout({
			customerId: 'cus_1',
			orgId: 'org_1',
			price: 16,
			credits: 1600,
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
						unit_amount: 1600,
						product_data: { name: '16 feega credits' }
					},
					quantity: 1
				}
			],
			success_url: 'https://app/return?ok=1',
			cancel_url: 'https://app/return?cancel=1',
			metadata: { app: 'feega', org_id: 'org_1', credits: '1600' },
			...withdrawalConsent
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
			successUrl: 'https://app/return?ok=1',
			cancelUrl: 'https://app/return?cancel=1'
		});

		expect(url).toBe('https://checkout/sub');
		expect(checkoutSessionsCreate).toHaveBeenCalledWith({
			mode: 'subscription',
			customer: 'cus_1',
			line_items: [{ price: 'price_sub_5', quantity: 1 }],
			success_url: 'https://app/return?ok=1',
			cancel_url: 'https://app/return?cancel=1',
			subscription_data: { metadata: { app: 'feega', org_id: 'org_1', credits: '500' } },
			metadata: { app: 'feega', org_id: 'org_1' },
			...withdrawalConsent
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
				successUrl: 'https://app/return',
				cancelUrl: 'https://app/return'
			})
		).rejects.toThrow('Stripe: no checkout URL');
	});
});

describe('paymentProcessingFee', () => {
	const charge = (fee: number) => ({ latest_charge: { balance_transaction: { fee } } });

	it('reads the fee of a top-up from its checkout payment', async () => {
		checkoutSessionsRetrieve.mockResolvedValue({ payment_intent: charge(49) });
		const { paymentProcessingFee } = await import('./stripe');

		expect(await paymentProcessingFee({ checkoutId: 'cs_1', invoiceId: null })).toBe(0.49);
		expect(checkoutSessionsRetrieve).toHaveBeenCalledWith('cs_1', {
			expand: ['payment_intent.latest_charge.balance_transaction']
		});
	});

	it('sums the fees of every payment of a subscription invoice', async () => {
		invoicePaymentsList.mockResolvedValue({
			data: [{ payment: { payment_intent: charge(30) } }, { payment: { payment_intent: charge(20) } }]
		});
		const { paymentProcessingFee } = await import('./stripe');

		expect(await paymentProcessingFee({ checkoutId: null, invoiceId: 'in_1' })).toBe(0.5);
		expect(invoicePaymentsList).toHaveBeenCalledWith({
			invoice: 'in_1',
			expand: ['data.payment.payment_intent.latest_charge.balance_transaction']
		});
	});

	it('is zero for a payment Stripe never saw', async () => {
		const { paymentProcessingFee } = await import('./stripe');
		expect(await paymentProcessingFee({ checkoutId: null, invoiceId: null })).toBe(0);
	});
});
