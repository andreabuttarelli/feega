import { describe, it, expect, vi, beforeEach } from 'vitest';

const ensureOrgCustomer = vi.fn();
const createOneTimeCreditCheckout = vi.fn();
const subscribedRungPrice = vi.fn();

vi.mock('$lib/server/stripe', () => ({
	ensureOrgCustomer: (...a: unknown[]) => ensureOrgCustomer(...a),
	createOneTimeCreditCheckout: (...a: unknown[]) => createOneTimeCreditCheckout(...a),
	subscribedRungPrice: (...a: unknown[]) => subscribedRungPrice(...a)
}));

import { load, actions } from './+page.server';

type Row = Record<string, unknown>;

type World = {
	org?: Partial<{ stripe_customer_id: string | null; stripe_subscription_id: string | null }>;
	role?: string;
	brands?: Row[];
	aiCalls?: Row[];
	atRisk?: Row[];
	balance?: number;
	ready?: boolean;
};

const ORG = { id: 'org-1', name: 'Ana', slug: 'ana' };

function fakeSupabase(world: World = {}) {
	const tables: Record<string, Row[]> = {
		orgs: [{ ...ORG, stripe_customer_id: 'cus_1', stripe_subscription_id: null, ...world.org }],
		orgs_members: [{ org_id: ORG.id, user_id: 'u1', role: world.role ?? 'owner', orgs: ORG }],
		brands: (world.brands ?? []).map((b) => ({ org_id: ORG.id, ...b })),
		ai_calls: world.aiCalls ?? [],
		org_credits_at_risk: (world.atRisk ?? []).map((r) => ({ org_id: ORG.id, ...r }))
	};
	const rpcs: Record<string, unknown> = {
		org_credit_balance: world.balance ?? 3600,
		billing_grants_ready: world.ready ?? true
	};

	function query(table: string) {
		let rows = tables[table] ?? [];
		const q: Record<string, unknown> = {};
		const chain = () => q;
		Object.assign(q, {
			select: chain,
			gte: chain,
			lt: chain,
			is: chain,
			order: chain,
			limit: chain,
			eq: (col: string, val: unknown) => {
				rows = rows.filter((r) => !(col in r) || r[col] === val);
				return q;
			},
			maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
			then: (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: rows, error: null })
		});
		return q;
	}

	return {
		auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'ana@example.com' } } }) },
		rpc: async (name: string) => ({ data: rpcs[name], error: null }),
		from: query
	};
}

const noCookies = { get: () => undefined };

function run(supabase: unknown, query = '') {
	return (load as (e: unknown) => Promise<Record<string, any>>)({
		locals: { supabase },
		cookies: noCookies,
		parent: async () => ({ org: { id: ORG.id } }),
		params: {},
		url: new URL(`https://example.test/app/credits${query}`)
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	ensureOrgCustomer.mockResolvedValue('cus_1');
	createOneTimeCreditCheckout.mockResolvedValue('https://checkout.stripe.com/c/pay/cs_test_one_time');
});

describe('/app/credits — the workspace credits page', () => {
	it('offers the six plans of feega.app', async () => {
		const data = await run(fakeSupabase());
		expect(data.credits.ladder.map((r: { price: number }) => r.price)).toEqual([8, 16, 32, 64, 128, 256]);
	});

	it('renders for a workspace without brands', async () => {
		const data = await run(fakeSupabase({ org: { stripe_customer_id: null } }));

		expect(data.brands).toEqual([]);
		expect(data.org.id).toBe('org-1');
		expect(data.credits.balance).toBe(3600);
		expect(data.hasBilling).toBe(false);
		expect(data.isOwner).toBe(true);
	});

	it('names the tier the workspace is subscribed to', async () => {
		subscribedRungPrice.mockResolvedValue(64);

		const data = await run(fakeSupabase({ org: { stripe_subscription_id: 'sub_1' } }));

		expect(subscribedRungPrice).toHaveBeenCalledWith('sub_1');
		expect(data.currentPlanUsd).toBe(64);
	});

	it('has no current plan without a subscription, and never asks Stripe', async () => {
		const data = await run(fakeSupabase());
		expect(data.currentPlanUsd).toBeNull();
		expect(subscribedRungPrice).not.toHaveBeenCalled();
	});

	it('still renders when Stripe cannot say which tier is current', async () => {
		subscribedRungPrice.mockRejectedValue(new Error('down'));
		expect((await run(fakeSupabase({ org: { stripe_subscription_id: 'sub_1' } }))).currentPlanUsd).toBeNull();
	});

	it('knows a checkout just came back paid', async () => {
		const data = await run(fakeSupabase(), '?checkout=success&session_id=cs_1');
		expect(data.checkoutOutcome).toBe('paid');
	});

	it('breaks usage down over every brand of the workspace', async () => {
		const data = await run(
			fakeSupabase({
				brands: [
					{ id: 'b1', name: 'One', slug: 'one' },
					{ id: 'b2', name: 'Two', slug: 'two' }
				],
				aiCalls: [
					{ brand_id: 'b1', cost_usd: 3 },
					{ brand_id: 'b2', cost_usd: 1 }
				]
			})
		);

		expect(data.brands).toEqual([
			{ id: 'b1', name: 'One', slug: 'one', credits: 600 },
			{ id: 'b2', name: 'Two', slug: 'two', credits: 200 }
		]);
	});

	it('reads owner status from orgs_members', async () => {
		expect((await run(fakeSupabase({ role: 'member' }))).isOwner).toBe(false);
	});

	it('shows credits about to expire, dropping a row with no expiry', async () => {
		const data = await run(
			fakeSupabase({
				atRisk: [
					{ next_expiry: '2026-10-07T00:00:00Z', expiring_credits: 100 },
					{ next_expiry: null, expiring_credits: null }
				]
			})
		);

		expect(data.credits.atRisk).toEqual([{ expiresAt: '2026-10-07T00:00:00Z', amount: 100 }]);
	});

	it('carries purchasesReady from the readiness gate', async () => {
		expect((await run(fakeSupabase({ ready: false }))).purchasesReady).toBe(false);
	});

	describe('actions.buyOneTime', () => {
		function call(supabase: unknown, usd: string) {
			const data = new FormData();
			data.set('usd', usd);
			return (actions.buyOneTime as (e: unknown) => Promise<unknown>)({
				request: { formData: async () => data },
				url: new URL('https://example.test/app/credits'),
				params: {},
				cookies: noCookies,
				locals: { supabase }
			});
		}

		it('opens a one-time Checkout Session for a workspace without brands', async () => {
			await expect(call(fakeSupabase({ org: { stripe_customer_id: null } }), '32')).rejects.toMatchObject({
				status: 303,
				location: 'https://checkout.stripe.com/c/pay/cs_test_one_time'
			});
			expect(ensureOrgCustomer).toHaveBeenCalledWith({ id: 'org-1', name: 'Ana', stripe_customer_id: null });
			expect(createOneTimeCreditCheckout).toHaveBeenCalledWith(
				expect.objectContaining({
					orgId: 'org-1',
					price: 32,
					credits: 3200,
					successUrl: 'https://example.test/app/credits?checkout=success&session_id={CHECKOUT_SESSION_ID}',
					cancelUrl: 'https://example.test/app/credits?checkout=canceled'
				})
			);
		});

		it('rejects a rung that is not on the ladder before touching Stripe', async () => {
			const result = await call(fakeSupabase(), '7');
			expect(result).toMatchObject({ status: 400, data: { billingError: 'Unknown one-time pack' } });
			expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
		});

		it('refuses a non-owner', async () => {
			const result = await call(fakeSupabase({ role: 'member' }), '32');
			expect(result).toMatchObject({ status: 403 });
			expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
		});

		it('refuses to sell when a grant could not land', async () => {
			const result = await call(fakeSupabase({ ready: false }), '32');
			expect(result).toMatchObject({ status: 409, data: { billingError: expect.stringMatching(/open soon/i) } });
			expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
		});
	});
});
