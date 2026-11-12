import { describe, it, expect, vi, beforeEach } from 'vitest';

const ensureOrgCustomer = vi.fn();
const createOneTimeCreditCheckout = vi.fn();
const subscribedPlan = vi.fn();
const seatSubscription = vi.fn();

vi.mock('$lib/server/stripe', () => ({
	ensureOrgCustomer: (...a: unknown[]) => ensureOrgCustomer(...a),
	createOneTimeCreditCheckout: (...a: unknown[]) => createOneTimeCreditCheckout(...a),
	subscribedPlan: (...a: unknown[]) => subscribedPlan(...a),
	seatSubscription: (...a: unknown[]) => seatSubscription(...a)
}));

const { privateEnv } = vi.hoisted(() => ({ privateEnv: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import { load, actions } from '$lib/server/dashboard/pages/credits';

const NATIVE_UA = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 FeegaNative/0.3.0';

type Row = Record<string, unknown>;

type World = {
	org?: Partial<{
		stripe_customer_id: string | null;
		stripe_subscription_id: string | null;
		store_plan_product: string | null;
		store_plan_expires_at: string | null;
	}>;
	role?: string;
	brands?: Row[];
	aiCalls?: Row[];
	balance?: number;
	ready?: boolean;
};

const ORG = { id: 'org-1', name: 'Ana', slug: 'ana' };

function fakeSupabase(world: World = {}) {
	const tables: Record<string, Row[]> = {
		orgs: [{ ...ORG, stripe_customer_id: 'cus_1', stripe_subscription_id: null, ...world.org }],
		orgs_members: [{ org_id: ORG.id, user_id: 'u1', role: world.role ?? 'owner', orgs: ORG }],
		brands: (world.brands ?? []).map((b) => ({ org_id: ORG.id, ...b })),
		ai_calls: world.aiCalls ?? []
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
			in: (col: string, vals: unknown[]) => {
				rows = rows.filter((r) => !(col in r) || vals.includes(r[col]));
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

function run(supabase: unknown, query = '', userAgent = 'Mozilla/5.0') {
	return (load as (e: unknown) => Promise<Record<string, any>>)({
		request: new Request('https://example.test/app/credits', { headers: { 'user-agent': userAgent } }),
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
	it('offers the one plan and the three top-ups', async () => {
		const data = await run(fakeSupabase());
		expect(data.plan).toEqual({ price: 9, credits: 500, lookupKey: 'feega_monthly_9' });
		expect(data.topUps.map((t: { price: number }) => t.price)).toEqual([10, 20, 50]);
	});

	it('renders for a workspace without brands', async () => {
		const data = await run(fakeSupabase({ org: { stripe_customer_id: null } }));

		expect(data.brands).toEqual([]);
		expect(data.org.id).toBe('org-1');
		expect(data.credits.balance).toBe(3600);
		expect(data.hasBilling).toBe(false);
		expect(data.isOwner).toBe(true);
	});

	it('names the plan the workspace is subscribed to, a retired price included', async () => {
		subscribedPlan.mockResolvedValue({ price: 64, credits: 6400, lookupKey: 'feega_monthly_64' });

		const data = await run(fakeSupabase({ org: { stripe_subscription_id: 'sub_1' } }));

		expect(subscribedPlan).toHaveBeenCalledWith('sub_1');
		expect(data.currentPlan).toMatchObject({ price: 64, credits: 6400 });
	});

	it('has no current plan without a subscription, and never asks Stripe', async () => {
		const data = await run(fakeSupabase());
		expect(data.currentPlan).toBeNull();
		expect(subscribedPlan).not.toHaveBeenCalled();
	});

	it('names the tier an app store subscription bought, while it has not expired', async () => {
		const later = new Date(Date.now() + 86_400_000).toISOString();

		const data = await run(fakeSupabase({ org: { store_plan_product: 'feega_monthly_32', store_plan_expires_at: later } }));

		expect(data.currentPlan).toMatchObject({ price: 32 });
		expect(subscribedPlan).not.toHaveBeenCalled();
	});

	it('forgets an app store subscription once it expired', async () => {
		const earlier = new Date(Date.now() - 1000).toISOString();

		const data = await run(fakeSupabase({ org: { store_plan_product: 'feega_monthly_32', store_plan_expires_at: earlier } }));

		expect(data.currentPlan).toBeNull();
	});

	it('still renders when Stripe cannot say which tier is current', async () => {
		subscribedPlan.mockRejectedValue(new Error('down'));
		expect((await run(fakeSupabase({ org: { stripe_subscription_id: 'sub_1' } }))).currentPlan).toBeNull();
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
			{ id: 'b1', name: 'One', slug: 'one', credits: 360 },
			{ id: 'b2', name: 'Two', slug: 'two', credits: 120 }
		]);
	});

	it('reads owner status from orgs_members', async () => {
		expect((await run(fakeSupabase({ role: 'member' }))).isOwner).toBe(false);
	});

	it('says how many editors the plan bills and when a cancelled plan ends', async () => {
		subscribedPlan.mockResolvedValue({ price: 9, credits: 500, lookupKey: 'feega_monthly_9' });
		seatSubscription.mockResolvedValue({ itemId: 'si_1', quantity: 1, perEditor: true, status: 'active', endsAt: '2026-12-13T00:00:00.000Z' });

		const data = await run(fakeSupabase({ org: { stripe_subscription_id: 'sub_1' } }));

		expect(data.seats).toMatchObject({ editors: 1, paid: true, endsAt: '2026-12-13T00:00:00.000Z' });
	});

	it('never warns of expiring credits: credits do not expire', async () => {
		const data = await run(fakeSupabase());
		expect(data.credits).toEqual({ balance: 3600 });
	});

	it('carries purchasesReady from the readiness gate', async () => {
		expect((await run(fakeSupabase({ ready: false }))).purchasesReady).toBe(false);
	});

	it('sells through the web checkout everywhere while store billing is off', async () => {
		privateEnv.NATIVE_STORE_BILLING = undefined;
		expect((await run(fakeSupabase(), '', NATIVE_UA)).billingChannel).toBe('web');
	});

	it('sells through the store inside the native app once store billing is on', async () => {
		privateEnv.NATIVE_STORE_BILLING = 'on';
		expect((await run(fakeSupabase(), '', NATIVE_UA)).billingChannel).toBe('store');
		expect((await run(fakeSupabase())).billingChannel).toBe('web');
		privateEnv.NATIVE_STORE_BILLING = undefined;
	});

	describe('actions.buyOneTime', () => {
		function call(supabase: unknown, credits: string) {
			const data = new FormData();
			data.set('credits', credits);
			return (actions.buyOneTime as (e: unknown) => Promise<unknown>)({
				request: { formData: async () => data },
				url: new URL('https://example.test/app/credits'),
				params: {},
				cookies: noCookies,
				locals: { supabase }
			});
		}

		it('opens a one-time Checkout Session for a workspace without brands', async () => {
			await expect(call(fakeSupabase({ org: { stripe_customer_id: null } }), '1000')).rejects.toMatchObject({
				status: 303,
				location: 'https://checkout.stripe.com/c/pay/cs_test_one_time'
			});
			expect(ensureOrgCustomer).toHaveBeenCalledWith({ id: 'org-1', name: 'Ana', stripe_customer_id: null });
			expect(createOneTimeCreditCheckout).toHaveBeenCalledWith(
				expect.objectContaining({
					orgId: 'org-1',
					price: 10,
					credits: 1000,
					successUrl: 'https://example.test/app/credits?checkout=success&session_id={CHECKOUT_SESSION_ID}',
					cancelUrl: 'https://example.test/app/credits?checkout=canceled'
				})
			);
		});

		it('rejects an amount that is not a top-up before touching Stripe', async () => {
			const result = await call(fakeSupabase(), '32');
			expect(result).toMatchObject({ status: 400, data: { billingError: 'Unknown top-up' } });
			expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
		});

		it('refuses a non-owner', async () => {
			const result = await call(fakeSupabase({ role: 'member' }), '1000');
			expect(result).toMatchObject({ status: 403 });
			expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
		});

		it('refuses to sell when a grant could not land', async () => {
			const result = await call(fakeSupabase({ ready: false }), '1000');
			expect(result).toMatchObject({ status: 409, data: { billingError: expect.stringMatching(/open soon/i) } });
			expect(createOneTimeCreditCheckout).not.toHaveBeenCalled();
		});
	});
});
