import { beforeEach, describe, expect, it, vi } from 'vitest';

const orgBillingById = vi.fn();
const isOrgOwner = vi.fn();
const createBillingPortalSession = vi.fn();
const applyRetentionCoupon = vi.fn();
const cancelSubscriptionAtPeriodEnd = vi.fn();
const ensureSubscriptionCanceled = vi.fn();
const ensureOrgCustomer = vi.fn();
const createSubscriptionCheckout = vi.fn();
const subscriptionPriceId = vi.fn();
const cloudPriceId = vi.fn();
const billingGrantsReady = vi.fn();

vi.mock('$lib/server/cli-auth', () => ({
	openOrg: vi.fn(),
	checkApiKeyWriteAccess: vi.fn(() => undefined)
}));
vi.mock('$lib/server/org-billing', () => ({
	orgBillingById: (...args: unknown[]) => orgBillingById(...args),
	isOrgOwner: (...args: unknown[]) => isOrgOwner(...args)
}));
vi.mock('$lib/server/stripe', () => ({
	createBillingPortalSession: (...args: unknown[]) => createBillingPortalSession(...args),
	applyRetentionCoupon: (...args: unknown[]) => applyRetentionCoupon(...args),
	cancelSubscriptionAtPeriodEnd: (...args: unknown[]) => cancelSubscriptionAtPeriodEnd(...args),
	ensureSubscriptionCanceled: (...args: unknown[]) => ensureSubscriptionCanceled(...args),
	ensureOrgCustomer: (...args: unknown[]) => ensureOrgCustomer(...args),
	createSubscriptionCheckout: (...args: unknown[]) => createSubscriptionCheckout(...args),
	subscriptionPriceId: (...args: unknown[]) => subscriptionPriceId(...args),
	cloudPriceId: (...args: unknown[]) => cloudPriceId(...args)
}));
vi.mock('$lib/server/billing-readiness', () => ({
	billingGrantsReady: (...args: unknown[]) => billingGrantsReady(...args)
}));
vi.mock('$lib/server/team/seat-billing', () => ({ editorCount: async () => 2 }));
vi.mock('$lib/server/app-url', () => ({ appOrigin: () => 'https://feega.test' }));

import { POST } from './+server';
import { openOrg, checkApiKeyWriteAccess } from '$lib/server/cli-auth';

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_live_plan';
const PLANS = [{ credits: 500, label: '€9 / editor / month' }];

const ORG_BILLING = {
	orgId: 'org-1',
	orgName: 'Acme',
	customerId: 'cus_org',
	subscriptionId: 'sub_org'
};

const ORG_BILLING_NO_SUBSCRIPTION = {
	orgId: 'org-1',
	orgName: 'Acme',
	customerId: 'cus_org',
	subscriptionId: null
};

function call(body: unknown = {}) {
	const url = new URL(`https://feega.test/api/v1/org/billing/checkout`);
	return (POST as (event: unknown) => Promise<Response>)({
		request: new Request(url, { method: 'POST', body: JSON.stringify(body) }),
		url
	}).then(async (res) => ({ res, body: await res.json().catch(() => null) }));
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(openOrg).mockResolvedValue({
		call: { supabase: {}, user: { id: 'user-1', email: 'ana@example.com' }, orgId: 'org-1', apiKey: undefined }
	} as never);
	vi.mocked(checkApiKeyWriteAccess).mockReturnValue(undefined);
	isOrgOwner.mockResolvedValue(true);
	orgBillingById.mockResolvedValue(ORG_BILLING_NO_SUBSCRIPTION);
	createBillingPortalSession.mockResolvedValue(CHECKOUT_URL);
	ensureOrgCustomer.mockResolvedValue('cus_org');
	createSubscriptionCheckout.mockResolvedValue(CHECKOUT_URL);
	subscriptionPriceId.mockResolvedValue('price_sub_9');
	cloudPriceId.mockImplementation((interval: string) => (interval === 'annual' ? 'price_cloud_y' : 'price_cloud_m'));
	billingGrantsReady.mockResolvedValue(true);
});

describe('POST /api/v1/org/billing/checkout with an interval', () => {
	it('checks out the monthly Cloud price', async () => {
		const { res } = await call({ interval: 'monthly' });

		expect(res.status).toBe(200);
		expect(createSubscriptionCheckout).toHaveBeenCalledWith(expect.objectContaining({ priceId: 'price_cloud_m', quantity: 2 }));
		expect(subscriptionPriceId).not.toHaveBeenCalled();
	});

	it('checks out the annual Cloud price', async () => {
		await call({ interval: 'annual' });

		expect(createSubscriptionCheckout).toHaveBeenCalledWith(expect.objectContaining({ priceId: 'price_cloud_y' }));
	});

	it('refuses with subscriptions_not_configured while the price env is unset', async () => {
		cloudPriceId.mockReturnValue(undefined);

		const { res, body } = await call({ interval: 'annual' });

		expect(res.status).toBe(409);
		expect(body.error).toBe('subscriptions_not_configured');
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it('refuses an unknown interval', async () => {
		const { res } = await call({ interval: 'weekly' });

		expect(res.status).toBe(400);
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});
});

describe('POST /api/v1/org/billing/checkout', () => {
	it('starts a real first subscription on the one plan and names it', async () => {
		const { res, body } = await call();

		expect(res.status).toBe(200);
		expect(body).toEqual({ ok: true, url: CHECKOUT_URL, plans: PLANS });
		expect(ensureOrgCustomer).toHaveBeenCalledWith(
			{ id: 'org-1', name: 'Acme', stripe_customer_id: 'cus_org' },
			'ana@example.com'
		);
		expect(createSubscriptionCheckout).toHaveBeenCalledWith({
			customerId: 'cus_org',
			orgId: 'org-1',
			priceId: 'price_sub_9',
			credits: 500,
			quantity: 2,
			successUrl: 'https://feega.test/app/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}',
			cancelUrl: 'https://feega.test/app/settings/billing?checkout=canceled'
		});
	});

	it('accepts the plan named by its credits', async () => {
		const { res } = await call({ credits: 500 });

		expect(res.status).toBe(200);
		expect(createSubscriptionCheckout).toHaveBeenCalled();
	});

	it('refuses an old ladder step loudly, naming the one plan, before touching Stripe', async () => {
		const { res, body } = await call({ credits: 32 });

		expect(res.status).toBe(400);
		expect(body.error).toBe('unknown_plan');
		expect(body.plans).toEqual(PLANS);
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it('refuses a second subscription and points at the billing page, never a plan switch', async () => {
		orgBillingById.mockResolvedValue(ORG_BILLING);

		const { res, body } = await call();

		expect(res.status).toBe(409);
		expect(body.error).toBe('already_subscribed');
		expect(body.app_billing_url).toBe('https://feega.test/app/settings/billing');
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
		expect(createBillingPortalSession).not.toHaveBeenCalled();
	});

	it('checks the owner against the org of the caller', async () => {
		await call();

		expect(isOrgOwner).toHaveBeenCalledWith(expect.anything(), 'org-1', 'user-1');
	});

	it('never cancels, never discounts', async () => {
		await call();

		expect(cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
		expect(applyRetentionCoupon).not.toHaveBeenCalled();
		expect(ensureSubscriptionCanceled).not.toHaveBeenCalled();
	});

	it('refuses a caller who does not own the org billing', async () => {
		isOrgOwner.mockResolvedValue(false);

		const { res, body } = await call();

		expect(res.status).toBe(403);
		expect(body.error).toBe('not_org_owner');
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it('says subscriptions_not_configured while the plan has no Stripe price, and never mints a broken session', async () => {
		subscriptionPriceId.mockResolvedValue(undefined);

		const { res, body } = await call();

		expect(res.status).toBe(409);
		expect(body.error).toBe('subscriptions_not_configured');
		expect(body.app_billing_url).toBe('https://feega.test/app/settings/billing');
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it('a Stripe outage is ours: 502, not a 4xx that accuses the caller', async () => {
		createSubscriptionCheckout.mockRejectedValue(new Error('connection error'));

		const { res, body } = await call();

		expect(res.status).toBe(502);
		expect(body.error).toBe('stripe_unavailable');
	});

	it('rejects a request without authentication', async () => {
		vi.mocked(openOrg).mockResolvedValue({
			error: new Response('Unauthorized', { status: 401 })
		} as never);

		const { res } = await call();

		expect(res.status).toBe(401);
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});


	it('rejects a read-only API key', async () => {
		vi.mocked(checkApiKeyWriteAccess).mockReturnValue(
			new Response(JSON.stringify({ error: 'API key is read-only' }), { status: 403 }) as never
		);

		const { res } = await call();

		expect(res.status).toBe(403);
		expect(createBillingPortalSession).not.toHaveBeenCalled();
	});

	it('rejects a discount the contract never declared instead of ignoring it', async () => {
		const { res, body } = await call({ coupon: 'FREE' });

		expect(res.status).toBe(400);
		expect(body.error).toBe('invalid_input');
		expect(createBillingPortalSession).not.toHaveBeenCalled();
	});

	it('refuses to sell when a grant could not land — the sync engine trigger is not there yet', async () => {
		billingGrantsReady.mockResolvedValue(false);

		const { res, body } = await call();

		expect(res.status).toBe(409);
		expect(body.error).toBe('purchases_not_ready');
		expect(createBillingPortalSession).not.toHaveBeenCalled();
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});
});
