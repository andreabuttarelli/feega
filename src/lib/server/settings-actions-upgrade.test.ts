import { beforeEach, describe, expect, it, vi } from 'vitest';

const orgBillingById = vi.fn();
const portalLink = vi.fn();
const ensureOrgCustomer = vi.fn();
const createSubscriptionCheckout = vi.fn();
const subscriptionPriceIdFor = vi.fn();
const billingGrantsReady = vi.fn();

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
	subscriptionPriceIdFor: (...args: unknown[]) => subscriptionPriceIdFor(...args)
}));
vi.mock('$lib/server/billing-readiness', () => ({
	billingGrantsReady: (...args: unknown[]) => billingGrantsReady(...args)
}));

import { upgrade } from './settings-actions';

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

function formEvent(usd: string) {
	const data = new FormData();
	data.set('usd', usd);
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

describe('upgrade — starting a first subscription for a ladder rung', () => {
	it('redirects straight to a real Checkout Session when no subscription exists yet', async () => {
		orgBillingById.mockResolvedValue(ORG_BILLING_NO_SUBSCRIPTION);
		subscriptionPriceIdFor.mockResolvedValue('price_sub_32');
		ensureOrgCustomer.mockResolvedValue('cus_org');
		createSubscriptionCheckout.mockResolvedValue('https://checkout.stripe.com/c/pay/cs_test_sub');

		await expect(upgrade(formEvent('32'))).rejects.toMatchObject({
			status: 303,
			location: 'https://checkout.stripe.com/c/pay/cs_test_sub'
		});
		expect(portalLink).not.toHaveBeenCalled();
		expect(createSubscriptionCheckout).toHaveBeenCalledWith(
			expect.objectContaining({
				customerId: 'cus_org',
				orgId: 'org-1',
				priceId: 'price_sub_32',
				credits: 3200,
				successUrl: 'https://feega.test/app/credits?checkout=success&session_id={CHECKOUT_SESSION_ID}',
				cancelUrl: 'https://feega.test/app/credits?checkout=canceled'
			})
		);
	});

	it('still goes through the hosted portal to CHANGE an existing subscription', async () => {
		orgBillingById.mockResolvedValue(ORG_BILLING_WITH_SUBSCRIPTION);
		portalLink.mockResolvedValue({ url: 'https://portal/upgrade' });

		await expect(upgrade(formEvent('32'))).rejects.toMatchObject({ status: 303, location: 'https://portal/upgrade' });
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it('fails plainly when the rung has no Stripe price configured, instead of minting a broken session', async () => {
		orgBillingById.mockResolvedValue(ORG_BILLING_NO_SUBSCRIPTION);
		subscriptionPriceIdFor.mockResolvedValue(undefined);

		const result = await upgrade(formEvent('32'));
		expect(result).toMatchObject({ status: 400, data: { billingError: expect.stringMatching(/not configured/i) } });
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it('rejects a rung that is not on the ladder before touching Stripe', async () => {
		orgBillingById.mockResolvedValue(ORG_BILLING_NO_SUBSCRIPTION);

		const result = await upgrade(formEvent('7'));
		expect(result).toMatchObject({ status: 400, data: { billingError: 'Unknown subscription tier' } });
		expect(subscriptionPriceIdFor).not.toHaveBeenCalled();
	});

	it('refuses to sell when a grant could not land — the sync engine trigger is not there yet', async () => {
		billingGrantsReady.mockResolvedValue(false);
		orgBillingById.mockResolvedValue(ORG_BILLING_NO_SUBSCRIPTION);

		const result = await upgrade(formEvent('32'));
		expect(result).toMatchObject({ status: 409, data: { billingError: expect.stringMatching(/open soon/i) } });
		expect(orgBillingById).not.toHaveBeenCalled();
		expect(createSubscriptionCheckout).not.toHaveBeenCalled();
		expect(portalLink).not.toHaveBeenCalled();
	});
});
