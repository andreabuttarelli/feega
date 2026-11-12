import { beforeEach, describe, expect, it, vi } from 'vitest';

const orgBillingById = vi.fn();
const portalLink = vi.fn();
const ensureOrgCustomer = vi.fn();
const createSubscriptionCheckout = vi.fn();
const subscriptionPriceId = vi.fn();
const createOneTimeCreditCheckout = vi.fn();
const billingGrantsReady = vi.fn();

vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/server/org-billing', () => ({
	orgBillingById: (...args: unknown[]) => orgBillingById(...args),
	isOrgOwner: async () => true
}));
vi.mock('$lib/server/billing-links', () => ({
	portalLink: (...args: unknown[]) => portalLink(...args)
}));
vi.mock('$lib/server/stripe', () => ({
	ensureOrgCustomer: (...args: unknown[]) => ensureOrgCustomer(...args),
	createSubscriptionCheckout: (...args: unknown[]) => createSubscriptionCheckout(...args),
	subscriptionPriceId: (...args: unknown[]) => subscriptionPriceId(...args),
	createOneTimeCreditCheckout: (...args: unknown[]) => createOneTimeCreditCheckout(...args)
}));
vi.mock('$lib/server/billing-readiness', () => ({
	billingGrantsReady: (...args: unknown[]) => billingGrantsReady(...args)
}));

import { buyOneTime, subscribe } from './settings-actions';

function ownerSupabase() {
	const memberships = [{ role: 'owner', orgs: { id: 'org-1', name: 'Acme', slug: 'acme' } }];
	const q = { select: () => q, eq: () => q, then: (resolve: (v: unknown) => void) => resolve({ data: memberships, error: null }) };
	return {
		auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
		from: () => q
	};
}

const ORG_BILLING_NO_SUBSCRIPTION = {
	orgId: 'org-1',
	orgName: 'Acme',
	customerId: 'cus_org',
	subscriptionId: null,
	brandCount: 1
};

const ORG_BILLING_WITH_SUBSCRIPTION = {
	orgId: 'org-1',
	orgName: 'Acme',
	customerId: 'cus_org',
	subscriptionId: 'sub_1',
	brandCount: 1
};

function formEvent(fields: Record<string, string> = {}) {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		data.set(key, value);
	}
	return {
		request: { formData: async () => data },
		params: {},
		cookies: { get: () => undefined },
		url: new URL('https://feega.test/app/credits'),
		locals: { supabase: ownerSupabase() }
	} as never;
}

beforeEach(() => {
	vi.clearAllMocks();
	billingGrantsReady.mockResolvedValue(true);
});

describe('subscribe — the one plan', () => {
	it('redirects straight to a real Checkout Session on the plan price', async () => {
		orgBillingById.mockResolvedValue(ORG_BILLING_NO_SUBSCRIPTION);
		subscriptionPriceId.mockResolvedValue('price_sub_9');
		ensureOrgCustomer.mockResolvedValue('cus_org');
		createSubscriptionCheckout.mockResolvedValue('https://checkout.stripe.com/c/pay/cs_test_sub');

		await expect(subscribe(formEvent())).rejects.toMatchObject({
			status: 303,
			location: 'https://checkout.stripe.com/c/pay/cs_test_sub'
		});
		expect(createSubscriptionCheckout).toHaveBeenCalledWith(
			expect.objectContaining({
				customerId: 'cus_org',
				orgId: 'org-1',
				priceId: 'price_sub_9',
				credits: 500,
				successUrl: 'https://feega.test/app/credits?checkout=success&session_id={CHECKOUT_SESSION_ID}',
				cancelUrl: 'https://feega.test/app/credits?checkout=canceled'
			})
		);
	});

	it('refuses a second subscription and never sends the owner to switch plan', async () => {
		orgBillingById.mockResolvedValue(ORG_BILLING_WITH_SUBSCRIPTION);

		const result = await subscribe(formEvent());
		expect(result).toMatchObject({ status: 409, data: { billingError: expect.stringMatching(/already subscribed/i) } });
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
		expect(portalLink).not.toHaveBeenCalled();
	});

	it('fails plainly when the plan has no Stripe price configured, instead of minting a broken session', async () => {
		orgBillingById.mockResolvedValue(ORG_BILLING_NO_SUBSCRIPTION);
		subscriptionPriceId.mockResolvedValue(undefined);

		const result = await subscribe(formEvent());
		expect(result).toMatchObject({ status: 400, data: { billingError: expect.stringMatching(/not configured/i) } });
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it('refuses to sell when a grant could not land — the sync engine trigger is not there yet', async () => {
		billingGrantsReady.mockResolvedValue(false);
		orgBillingById.mockResolvedValue(ORG_BILLING_NO_SUBSCRIPTION);

		const result = await subscribe(formEvent());
		expect(result).toMatchObject({ status: 409, data: { billingError: expect.stringMatching(/open soon/i) } });
		expect(orgBillingById).not.toHaveBeenCalled();
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});
});

describe('buyOneTime — the three top-ups', () => {
	it('checks out €20 for 2,000 credits', async () => {
		orgBillingById.mockResolvedValue(ORG_BILLING_WITH_SUBSCRIPTION);
		ensureOrgCustomer.mockResolvedValue('cus_org');
		createOneTimeCreditCheckout.mockResolvedValue('https://checkout.stripe.com/c/pay/cs_test_pack');

		await expect(buyOneTime(formEvent({ credits: '2000' }))).rejects.toMatchObject({
			status: 303,
			location: 'https://checkout.stripe.com/c/pay/cs_test_pack'
		});
		expect(createOneTimeCreditCheckout).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1', price: 20, credits: 2000 }));
	});

	it('refuses an amount that is not a top-up, such as an old ladder step', async () => {
		orgBillingById.mockResolvedValue(ORG_BILLING_WITH_SUBSCRIPTION);

		const result = await buyOneTime(formEvent({ credits: '16' }));
		expect(result).toMatchObject({ status: 400, data: { billingError: 'Unknown top-up' } });
		expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
	});
});
