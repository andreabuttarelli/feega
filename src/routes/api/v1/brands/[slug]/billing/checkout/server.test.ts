import { beforeEach, describe, expect, it, vi } from 'vitest';

const orgBillingForBrand = vi.fn();
const isOrgOwner = vi.fn();
const createBillingPortalSession = vi.fn();
const applyRetentionCoupon = vi.fn();
const cancelSubscriptionAtPeriodEnd = vi.fn();
const ensureSubscriptionCanceled = vi.fn();
const ensureOrgCustomer = vi.fn();
const createSubscriptionCheckout = vi.fn();
const subscriptionPriceId = vi.fn();
const gateCredits = vi.fn();
const structured = vi.fn();
const billingGrantsReady = vi.fn();

vi.mock('$lib/server/tenancy/brand-slug', () => ({
	appPathForBrand: async (_db: unknown, _brandId: string, path: string) => `/p/p1${path}`
}));
vi.mock('$lib/server/cli-auth', () => ({
	authenticate: vi.fn(),
	loadBrandForUser: vi.fn(),
	checkApiKeyWriteAccess: vi.fn(() => undefined),
	gateAiAction: vi.fn()
}));
vi.mock('$lib/server/org-billing', () => ({
	orgBillingForBrand: (...args: unknown[]) => orgBillingForBrand(...args),
	isOrgOwner: (...args: unknown[]) => isOrgOwner(...args)
}));
vi.mock('$lib/server/stripe', () => ({
	createBillingPortalSession: (...args: unknown[]) => createBillingPortalSession(...args),
	applyRetentionCoupon: (...args: unknown[]) => applyRetentionCoupon(...args),
	cancelSubscriptionAtPeriodEnd: (...args: unknown[]) => cancelSubscriptionAtPeriodEnd(...args),
	ensureSubscriptionCanceled: (...args: unknown[]) => ensureSubscriptionCanceled(...args),
	ensureOrgCustomer: (...args: unknown[]) => ensureOrgCustomer(...args),
	createSubscriptionCheckout: (...args: unknown[]) => createSubscriptionCheckout(...args),
	subscriptionPriceId: (...args: unknown[]) => subscriptionPriceId(...args)
}));
vi.mock('$lib/server/credits', () => ({
	gateCredits: (...args: unknown[]) => gateCredits(...args),
	CreditsExhaustedError: class extends Error {}
}));
vi.mock('$lib/server/billing-readiness', () => ({
	billingGrantsReady: (...args: unknown[]) => billingGrantsReady(...args)
}));
vi.mock('$lib/server/team/seat-billing', () => ({ editorCount: async () => 2 }));
vi.mock('$lib/server/research', () => ({ structured: (...args: unknown[]) => structured(...args) }));
vi.mock('$lib/server/app-url', () => ({ appOrigin: () => 'https://feega.test' }));
vi.mock('$lib/server/feature-flags', () => ({ isPlanGoEnabled: () => false }));

import { POST } from './+server';
import { authenticate, loadBrandForUser, checkApiKeyWriteAccess, gateAiAction } from '$lib/server/cli-auth';

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_live_plan';
const PLANS = [{ credits: 500, label: '€9 / editor / month' }];

const ORG_BILLING = {
	orgId: 'org-1',
	orgName: 'Acme',
	customerId: 'cus_org',
	subscriptionId: 'sub_org',
	brandCount: 2
};

const ORG_BILLING_NO_SUBSCRIPTION = {
	orgId: 'org-1',
	orgName: 'Acme',
	customerId: 'cus_org',
	subscriptionId: null,
	brandCount: 1
};

function call(body: unknown = {}, slug = 'demo') {
	const url = new URL(`https://feega.test/api/v1/brands/${slug}/billing/checkout`);
	return (POST as (event: unknown) => Promise<Response>)({
		request: new Request(url, { method: 'POST', body: JSON.stringify(body) }),
		params: { slug },
		url
	}).then(async (res) => ({ res, body: await res.json().catch(() => null) }));
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(authenticate).mockResolvedValue({
		supabase: {},
		user: { id: 'user-1' },
		apiKey: undefined,
		error: null
	} as never);
	vi.mocked(loadBrandForUser).mockResolvedValue({
		brand: { id: 'brand-1', org_id: 'org-1', slug: 'demo' },
		error: null
	} as never);
	vi.mocked(checkApiKeyWriteAccess).mockReturnValue(undefined);
	isOrgOwner.mockResolvedValue(true);
	orgBillingForBrand.mockResolvedValue(ORG_BILLING_NO_SUBSCRIPTION);
	createBillingPortalSession.mockResolvedValue(CHECKOUT_URL);
	ensureOrgCustomer.mockResolvedValue('cus_org');
	createSubscriptionCheckout.mockResolvedValue(CHECKOUT_URL);
	subscriptionPriceId.mockResolvedValue('price_sub_9');
	billingGrantsReady.mockResolvedValue(true);
});

describe('POST /api/v1/brands/:slug/billing/checkout', () => {
	it('starts a real first subscription on the one plan and names it', async () => {
		const { res, body } = await call();

		expect(res.status).toBe(200);
		expect(body).toEqual({ ok: true, url: CHECKOUT_URL, plans: PLANS });
		expect(ensureOrgCustomer).toHaveBeenCalledWith({ id: 'org-1', name: 'Acme', stripe_customer_id: 'cus_org' });
		expect(createSubscriptionCheckout).toHaveBeenCalledWith({
			customerId: 'cus_org',
			orgId: 'org-1',
			priceId: 'price_sub_9',
			credits: 500,
			quantity: 2,
			successUrl: 'https://feega.test/app/credits?checkout=success&session_id={CHECKOUT_SESSION_ID}',
			cancelUrl: 'https://feega.test/app/credits?checkout=canceled'
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
		orgBillingForBrand.mockResolvedValue(ORG_BILLING);

		const { res, body } = await call();

		expect(res.status).toBe(409);
		expect(body.error).toBe('already_subscribed');
		expect(body.app_billing_url).toBe('https://feega.test/app/credits');
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
		expect(createBillingPortalSession).not.toHaveBeenCalled();
	});

	it('checks the owner against the org the brand belongs to', async () => {
		await call();

		expect(isOrgOwner).toHaveBeenCalledWith(expect.anything(), 'org-1', 'user-1');
	});

	it('never cancels, never discounts', async () => {
		await call();

		expect(cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
		expect(applyRetentionCoupon).not.toHaveBeenCalled();
		expect(ensureSubscriptionCanceled).not.toHaveBeenCalled();
	});

	it('never gates on credits: whoever ran out is exactly who needs this link', async () => {
		await call();

		expect(gateAiAction).not.toHaveBeenCalled();
		expect(gateCredits).not.toHaveBeenCalled();
		expect(structured).not.toHaveBeenCalled();
	});

	it('refuses a caller who reaches the brand but does not own the org billing', async () => {
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
		expect(body.app_billing_url).toBe('https://feega.test/app/credits');
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it('a Stripe outage is ours: 502, not a 4xx that accuses the caller', async () => {
		createSubscriptionCheckout.mockRejectedValue(new Error('connection error'));

		const { res, body } = await call();

		expect(res.status).toBe(502);
		expect(body.error).toBe('stripe_unavailable');
	});

	it('rejects a request without authentication', async () => {
		vi.mocked(authenticate).mockResolvedValue({
			error: new Response('Unauthorized', { status: 401 })
		} as never);

		const { res } = await call();

		expect(res.status).toBe(401);
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it('rejects a brand the caller cannot reach', async () => {
		vi.mocked(loadBrandForUser).mockResolvedValue({
			error: new Response(JSON.stringify({ error: 'Brand not found' }), { status: 404 })
		} as never);

		const { res } = await call({}, 'altrui');

		expect(res.status).toBe(404);
		expect(createBillingPortalSession).not.toHaveBeenCalled();
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
