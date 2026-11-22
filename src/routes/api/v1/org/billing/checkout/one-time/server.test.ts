import { beforeEach, describe, expect, it, vi } from 'vitest';

const orgBillingById = vi.fn();
const isOrgOwner = vi.fn();
const ensureOrgCustomer = vi.fn();
const createOneTimeCreditCheckout = vi.fn();
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
	ensureOrgCustomer: (...args: unknown[]) => ensureOrgCustomer(...args),
	createOneTimeCreditCheckout: (...args: unknown[]) => createOneTimeCreditCheckout(...args)
}));
vi.mock('$lib/server/billing-readiness', () => ({
	billingGrantsReady: (...args: unknown[]) => billingGrantsReady(...args)
}));
vi.mock('$lib/server/app-url', () => ({ appOrigin: () => 'https://feega.test' }));

import { POST } from './+server';
import { openOrg, checkApiKeyWriteAccess } from '$lib/server/cli-auth';

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_one_time';

const ORG_BILLING = {
	orgId: 'org-1',
	orgName: 'Acme',
	customerId: 'cus_org',
	subscriptionId: null
};

const ORG_BILLING_NO_CUSTOMER = {
	orgId: 'org-1',
	orgName: 'Acme',
	customerId: null,
	subscriptionId: null
};

function call(body: unknown = { credits: 2000 }) {
	const url = new URL(`https://feega.test/api/v1/org/billing/checkout/one-time`);
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
	orgBillingById.mockResolvedValue(ORG_BILLING);
	ensureOrgCustomer.mockResolvedValue('cus_org');
	createOneTimeCreditCheckout.mockResolvedValue(CHECKOUT_URL);
	billingGrantsReady.mockResolvedValue(true);
});

describe('POST /api/v1/org/billing/checkout/one-time', () => {
	it('creates a payment-mode session for the ladder rung and returns its credits', async () => {
		const { res, body } = await call({ credits: 2000 });

		expect(res.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.url).toBe(CHECKOUT_URL);
		expect(body.credits).toBe(2000);
		expect(createOneTimeCreditCheckout).toHaveBeenCalledWith({
			customerId: 'cus_org',
			orgId: 'org-1',
			price: 20,
			credits: 2000,
			successUrl: 'https://feega.test/app/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}',
			cancelUrl: 'https://feega.test/app/settings/billing?checkout=canceled'
		});
	});

	it('creates the org Stripe customer on the spot when none exists yet — no subscription required first', async () => {
		orgBillingById.mockResolvedValue(ORG_BILLING_NO_CUSTOMER);

		const { res } = await call({ credits: 2000 });

		expect(res.status).toBe(200);
		expect(ensureOrgCustomer).toHaveBeenCalledWith({
			id: 'org-1',
			name: 'Acme',
			stripe_customer_id: null
		}, 'ana@example.com');
	});

	it('rejects an amount that is not a top-up, an old ladder step included, before touching Stripe', async () => {
		const { res, body } = await call({ credits: 32 });

		expect(res.status).toBe(400);
		expect(body.error).toBe('unknown_plan');
		expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
	});

	it('requires credits — there is no picker mode for a one-time purchase', async () => {
		const { res, body } = await call({});

		expect(res.status).toBe(400);
		expect(body.error).toBe('invalid_input');
		expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
	});

	it('checks the owner against the org of the caller', async () => {
		await call({ credits: 2000 });
		expect(isOrgOwner).toHaveBeenCalledWith(expect.anything(), 'org-1', 'user-1');
	});

	it('refuses a caller who does not own the org billing', async () => {
		isOrgOwner.mockResolvedValue(false);

		const { res, body } = await call({ credits: 2000 });

		expect(res.status).toBe(403);
		expect(body.error).toBe('not_org_owner');
		expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
	});

	it('a Stripe outage is ours: 502, not a 4xx that accuses the caller', async () => {
		createOneTimeCreditCheckout.mockRejectedValue(new Error('connection error'));

		const { res, body } = await call({ credits: 2000 });

		expect(res.status).toBe(502);
		expect(body.error).toBe('stripe_unavailable');
	});

	it('rejects a request without authentication', async () => {
		vi.mocked(openOrg).mockResolvedValue({
			error: new Response('Unauthorized', { status: 401 })
		} as never);

		const { res } = await call();

		expect(res.status).toBe(401);
		expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
	});


	it('rejects a read-only API key', async () => {
		vi.mocked(checkApiKeyWriteAccess).mockReturnValue(
			new Response(JSON.stringify({ error: 'API key is read-only' }), { status: 403 }) as never
		);

		const { res } = await call({ credits: 2000 });

		expect(res.status).toBe(403);
		expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
	});

	it('rejects a field the contract never declared instead of ignoring it', async () => {
		const { res, body } = await call({ credits: 2000, coupon: 'FREE' });

		expect(res.status).toBe(400);
		expect(body.error).toBe('invalid_input');
		expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
	});

	it('refuses to sell when a grant could not land — the sync engine trigger is not there yet', async () => {
		billingGrantsReady.mockResolvedValue(false);

		const { res, body } = await call({ credits: 2000 });

		expect(res.status).toBe(409);
		expect(body.error).toBe('purchases_not_ready');
		expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
	});
});
