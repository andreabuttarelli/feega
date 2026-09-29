import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The account-level billing page answers for the ORGANIZATION: one credit balance, one Stripe
 * customer, and a per-brand table that says who is spending it. `organizations` doesn't exist on
 * this schema — the org's Stripe ids live on `orgs` directly, and there's no `plan` column
 * anywhere: the pool is the credit_ledger balance (org_credit_balance), not a quota tied to a
 * plan name.
 */

const orgCreditBalance = vi.fn();
const settingsScope = vi.fn();
const billingPortal = vi.fn();
const isOrgOwner = vi.fn();
const ensureOrgCustomer = vi.fn();
const createOneTimeCreditCheckout = vi.fn();
const billingGrantsReady = vi.fn();
const orgBillingById = vi.fn();
const subscribedRungPrice = vi.fn();

vi.mock('$lib/server/credits', () => ({
	orgCreditBalance: (...a: unknown[]) => orgCreditBalance(...a)
}));
vi.mock('$lib/server/settings-actions', () => ({
	billingPortal: (...a: unknown[]) => billingPortal(...a),
	upgrade: vi.fn(),
	applyRetention: vi.fn(),
	cancelPlan: vi.fn(),
	settingsScope: (...a: unknown[]) => settingsScope(...a),
	billingPath: (id: string) => `/p/${id}/settings/billing`
}));
vi.mock('$lib/server/org-billing', () => ({
	isOrgOwner: (...a: unknown[]) => isOrgOwner(...a),
	orgBillingById: (...a: unknown[]) => orgBillingById(...a)
}));
vi.mock('$lib/server/stripe', () => ({
	ensureOrgCustomer: (...a: unknown[]) => ensureOrgCustomer(...a),
	createOneTimeCreditCheckout: (...a: unknown[]) => createOneTimeCreditCheckout(...a),
	subscribedRungPrice: (...a: unknown[]) => subscribedRungPrice(...a)
}));
vi.mock('$lib/server/billing-readiness', () => ({
	billingGrantsReady: (...a: unknown[]) => billingGrantsReady(...a)
}));

import { load, actions } from './+page.server';

type OrgRow = { id: string; name: string; stripe_customer_id: string | null };
type Membership = { role: string };
type BrandRow = { id: string; name: string; slug: string };

/** orgs + orgs_members (owner check) + brands (by org_id) + ai_calls (per-brand spend, summed in JS). */
function fakeSupabase(
	org: OrgRow | null,
	membership: Membership | null,
	brands: BrandRow[],
	costUsdByBrand: Record<string, number> = {},
	atRisk: { next_expiry: string; expiring_credits: number }[] = []
) {
	return {
		auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'ana@example.com' } } }) },
		from: (table: string) => {
			if (table === 'orgs') {
				return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: org, error: null }) }) }) };
			}
			if (table === 'org_credits_at_risk') {
				const q: Record<string, unknown> = {};
				Object.assign(q, {
					select: () => q,
					eq: () => q,
					order: () => q,
					then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: atRisk, error: null })
				});
				return q;
			}
			if (table === 'orgs_members') {
				return {
					select: () => ({
						eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: membership, error: null }) }) })
					})
				};
			}
			if (table === 'brands') {
				const q: Record<string, unknown> = {};
				Object.assign(q, {
					select: () => q,
					eq: () => q,
					limit: () => q,
					maybeSingle: async () => ({ data: brands[0] ?? null, error: null }),
					then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: brands, error: null })
				});
				return q;
			}
			if (table === 'ai_calls') {
				const q: Record<string, unknown> = {};
				let brandId: string | undefined;
				Object.assign(q, {
					select: () => q,
					eq: (col: string, val: string) => {
						if (col === 'brand_id') brandId = val;
						return q;
					},
					gte: () => q,
					lt: () => q,
					then: (resolve: (v: { data: unknown; error: null }) => void) =>
						resolve({ data: [{ cost_usd: costUsdByBrand[brandId ?? ''] ?? 0 }], error: null })
				});
				return q;
			}
			throw new Error(`unexpected table ${table}`);
		}
	};
}

function run(supabase: unknown, query = '') {
	return (load as (e: unknown) => Promise<Record<string, any>>)({
		locals: { supabase },
		parent: async () => ({ org: { id: 'org-1' } }),
		params: { projectId: 'p1' },
		url: new URL(`https://example.test/p/p1/settings/billing${query}`)
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	orgCreditBalance.mockResolvedValue(3600);
	settingsScope.mockResolvedValue({ projectId: 'p1', orgId: 'org-1', brand: null });
	isOrgOwner.mockResolvedValue(true);
	ensureOrgCustomer.mockResolvedValue('cus_1');
	createOneTimeCreditCheckout.mockResolvedValue('https://checkout.stripe.com/c/pay/cs_test_one_time');
	billingGrantsReady.mockResolvedValue(true);
	orgBillingById.mockResolvedValue({ subscriptionId: null });
});

describe('project settings billing', () => {
	const ownerOrg = () =>
		fakeSupabase({ id: 'org-1', name: 'Ana', stripe_customer_id: 'cus_1' }, { role: 'owner' }, []);

	it('offers the six plans of feega.app', async () => {
		const data = await run(ownerOrg());
		expect(data.credits.ladder.map((r: { price: number }) => r.price)).toEqual([8, 16, 32, 64, 128, 256]);
	});

	it('names the tier the org is subscribed to', async () => {
		orgBillingById.mockResolvedValue({ subscriptionId: 'sub_1' });
		subscribedRungPrice.mockResolvedValue(64);

		const data = await run(ownerOrg());

		expect(subscribedRungPrice).toHaveBeenCalledWith('sub_1');
		expect(data.currentPlanUsd).toBe(64);
	});

	it('has no current plan without a subscription, and never asks Stripe', async () => {
		const data = await run(ownerOrg());
		expect(data.currentPlanUsd).toBeNull();
		expect(subscribedRungPrice).not.toHaveBeenCalled();
	});

	it('still renders when Stripe cannot say which tier is current', async () => {
		orgBillingById.mockResolvedValue({ subscriptionId: 'sub_1' });
		subscribedRungPrice.mockRejectedValue(new Error('down'));
		expect((await run(ownerOrg())).currentPlanUsd).toBeNull();
	});

	it('knows a checkout just came back paid', async () => {
		const data = await run(ownerOrg(), '?checkout=success&session_id=cs_1');
		expect(data.checkoutOutcome).toBe('paid');
	});

	it('shows the org credit balance once, not a per-brand quota', async () => {
		const data = await run(
			fakeSupabase(
				{ id: 'org-1', name: 'Ana', stripe_customer_id: 'cus_1' },
				{ role: 'owner' },
				[
					{ id: 'b1', name: 'One', slug: 'one' },
					{ id: 'b2', name: 'Two', slug: 'two' }
				]
			)
		);

		expect(orgCreditBalance).toHaveBeenCalledTimes(1);
		expect(data.credits.balance).toBe(3600);
		expect(data.org.name).toBe('Ana');
	});

	it('breaks usage down over every brand of the org', async () => {
		const data = await run(
			fakeSupabase(
				{ id: 'org-1', name: 'Ana', stripe_customer_id: 'cus_1' },
				{ role: 'owner' },
				[
					{ id: 'b1', name: 'One', slug: 'one' },
					{ id: 'b2', name: 'Two', slug: 'two' }
				],
				{ b1: 3, b2: 1 }
			)
		);

		expect(data.brands).toEqual([
			{ id: 'b1', name: 'One', slug: 'one', credits: 600 },
			{ id: 'b2', name: 'Two', slug: 'two', credits: 200 }
		]);
	});

	it('has billing once the org carries a Stripe customer', async () => {
		const data = await run(
			fakeSupabase({ id: 'org-1', name: 'Ana', stripe_customer_id: 'cus_1' }, { role: 'owner' }, [
				{ id: 'b1', name: 'One', slug: 'one' }
			])
		);

		expect(data.hasBilling).toBe(true);
	});

	it('runs the billing actions of the project settings unchanged', () => {
		expect(actions.billingPortal).toBeDefined();
		expect(actions.upgrade).toBeDefined();
	});

	it('offers billing to an org without brands', async () => {
		const data = await run(
			fakeSupabase({ id: 'org-1', name: 'Ana', stripe_customer_id: null }, { role: 'owner' }, [])
		);

		expect(data.brands).toEqual([]);
		expect(data.org.id).toBe('org-1');
	});

	it('reads the org owner status from orgs_members, not organizations.owner_id', async () => {
		const data = await run(
			fakeSupabase({ id: 'org-1', name: 'Ana', stripe_customer_id: 'cus_1' }, { role: 'member' }, [
				{ id: 'b1', name: 'One', slug: 'one' }
			])
		);

		expect(data.isOwner).toBe(false);
	});

	it('shows credits about to expire, from org_credits_at_risk (expiring_credits/next_expiry — the columns the live view actually has)', async () => {
		const data = await run(
			fakeSupabase(
				{ id: 'org-1', name: 'Ana', stripe_customer_id: 'cus_1' },
				{ role: 'owner' },
				[{ id: 'b1', name: 'One', slug: 'one' }],
				{},
				[{ next_expiry: '2026-10-07T00:00:00Z', expiring_credits: 100 }]
			)
		);

		expect(data.credits.atRisk).toEqual([{ expiresAt: '2026-10-07T00:00:00Z', amount: 100 }]);
	});

	it('drops an at-risk row with no expiry instead of showing epoch 1970', async () => {
		const data = await run(
			fakeSupabase(
				{ id: 'org-1', name: 'Ana', stripe_customer_id: 'cus_1' },
				{ role: 'owner' },
				[{ id: 'b1', name: 'One', slug: 'one' }],
				{},
				[{ next_expiry: null, expiring_credits: null } as unknown as { next_expiry: string; expiring_credits: number }]
			)
		);

		expect(data.credits.atRisk).toEqual([]);
	});

	it('carries purchasesReady from the readiness gate, so the page can hide the buy buttons', async () => {
		billingGrantsReady.mockResolvedValue(false);

		const data = await run(
			fakeSupabase({ id: 'org-1', name: 'Ana', stripe_customer_id: 'cus_1' }, { role: 'owner' }, [
				{ id: 'b1', name: 'One', slug: 'one' }
			])
		);

		expect(data.purchasesReady).toBe(false);
	});

	describe('actions.buyOneTime', () => {
		function call(supabase: unknown, usd: string) {
			const data = new FormData();
			data.set('usd', usd);
			return (actions.buyOneTime as (e: unknown) => Promise<unknown>)({
				request: { formData: async () => data },
				url: new URL('https://example.test/p/p1/settings/billing'),
				params: { projectId: 'p1' },
				locals: { supabase }
			});
		}

		it('redirects to a real one-time Checkout Session for the picked rung', async () => {
			const supabase = fakeSupabase({ id: 'org-1', name: 'Ana', stripe_customer_id: 'cus_1' }, { role: 'owner' }, []);

			await expect(call(supabase, '32')).rejects.toMatchObject({
				status: 303,
				location: 'https://checkout.stripe.com/c/pay/cs_test_one_time'
			});
			expect(createOneTimeCreditCheckout).toHaveBeenCalledWith(
				expect.objectContaining({
					orgId: 'org-1',
					price: 32,
					credits: 3200,
					successUrl: 'https://example.test/p/p1/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}',
					cancelUrl: 'https://example.test/p/p1/settings/billing?checkout=canceled'
				})
			);
		});

		it('rejects a rung that is not on the ladder before touching Stripe', async () => {
			const supabase = fakeSupabase({ id: 'org-1', name: 'Ana', stripe_customer_id: 'cus_1' }, { role: 'owner' }, []);

			const result = await call(supabase, '7');
			expect(result).toMatchObject({ status: 400, data: { billingError: 'Unknown one-time pack' } });
			expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
		});

		it('refuses a non-owner', async () => {
			isOrgOwner.mockResolvedValue(false);
			const supabase = fakeSupabase({ id: 'org-1', name: 'Ana', stripe_customer_id: 'cus_1' }, { role: 'member' }, []);

			const result = await call(supabase, '32');
			expect(result).toMatchObject({ status: 403 });
			expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
		});

		it('refuses to sell when a grant could not land — the sync engine trigger is not there yet', async () => {
			billingGrantsReady.mockResolvedValue(false);
			const supabase = fakeSupabase({ id: 'org-1', name: 'Ana', stripe_customer_id: 'cus_1' }, { role: 'owner' }, []);

			const result = await call(supabase, '32');
			expect(result).toMatchObject({ status: 409, data: { billingError: expect.stringMatching(/open soon/i) } });
			expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
		});
	});
});
