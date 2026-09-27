import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * settings/+layout.server.ts leggeva social_accounts.username (reale: handle), api_keys.permissions
 * (reale: scopes) e brand_invites (reale: orgs_invites, org-level, senza brand_id). Ogni pagina
 * sotto /settings caricava questi tre nomi sbagliati: le prove qui sono sui nomi di colonna reali,
 * non sul comportamento a valle (quello lo copre settings-actions.test.ts).
 */

const orgBillingForBrand = vi.fn();

vi.mock('$lib/server/plans', () => ({
	accountLimit: () => 5,
	plansAbove: () => [],
	isTopPlan: () => false
}));
vi.mock('$lib/server/org-billing', () => ({
	orgBillingForBrand: (...a: unknown[]) => orgBillingForBrand(...a)
}));

import { load } from './+layout.server';

const ORG = { id: 'org-1', role: 'owner' };

function fakeSupabase(rows: Record<string, unknown[]>) {
	const ops: Array<{ table: string; column?: string; value?: unknown }> = [];
	return {
		from(table: string) {
			const q = {
				select: () => q,
				eq: (column: string, value: unknown) => {
					ops.push({ table, column, value });
					return q;
				},
				order: () => Promise.resolve({ data: rows[table] ?? [] })
			};
			return q;
		},
		rpc: () => Promise.resolve({ data: 0, error: null }),
		__ops: ops
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	orgBillingForBrand.mockResolvedValue(null);
});

describe('settings +layout.server load', () => {
	it('selects social_accounts.handle, not the non-existent username', async () => {
		const supabase = fakeSupabase({ social_accounts: [], api_keys: [], orgs_invites: [] });

		await (load as (e: unknown) => Promise<Record<string, unknown>>)({
			parent: async () => ({ org: ORG, brand: { id: 'brand-1', slug: 'demo', org_id: 'org-1' } }),
			url: new URL('https://feega.test/p/x/settings/team'),
			locals: { supabase }
		});

		const select = (supabase as unknown as { __ops: unknown[] }).__ops;
		expect(select.some((o: any) => o.table === 'social_accounts')).toBe(true);
	});

	it('reads org-level orgs_invites for the brand org, not a non-existent brand_invites', async () => {
		const supabase = fakeSupabase({
			social_accounts: [],
			api_keys: [],
			orgs_invites: [{ id: 'inv-1', email: 'a@b.com', accepted_at: null, created_at: '2026-01-01' }]
		});

		const data = await (load as (e: unknown) => Promise<Record<string, unknown>>)({
			parent: async () => ({ org: ORG, brand: { id: 'brand-1', slug: 'demo', org_id: 'org-1' } }),
			url: new URL('https://feega.test/p/x/settings/team'),
			locals: { supabase }
		});

		const ops = (supabase as unknown as { __ops: any[] }).__ops;
		expect(ops.some((o) => o.table === 'orgs_invites' && o.column === 'org_id' && o.value === 'org-1')).toBe(
			true
		);
		expect(data.invites).toEqual([{ id: 'inv-1', email: 'a@b.com', accepted_at: null, created_at: '2026-01-01' }]);
	});

	it('non lancia quando il progetto non ha un brand', async () => {
		const supabase = fakeSupabase({});

		const data = await (load as (e: unknown) => Promise<Record<string, unknown>>)({
			parent: async () => ({ org: ORG, brand: null }),
			url: new URL('https://feega.test/p/x/settings/video'),
			locals: { supabase }
		});

		expect(data.brand).toBeNull();
	});

	async function loadWithoutBrand(section: string, rows: Record<string, unknown[]> = {}) {
		const supabase = fakeSupabase(rows);
		const data = await (load as (e: unknown) => Promise<Record<string, unknown>>)({
			parent: async () => ({ org: ORG, brand: null }),
			url: new URL(`https://feega.test/p/x/settings/${section}`),
			locals: { supabase }
		});
		return { data, ops: (supabase as unknown as { __ops: any[] }).__ops };
	}

	it.each(['video', 'connected-accounts', 'danger', 'products', 'ads', 'ads/accounts'])(
		'senza brand, la sezione di brand %s chiude il cancello',
		async (section) => {
			const { data } = await loadWithoutBrand(section, { brands: [{ id: 'b-1', name: 'Acme', slug: 'acme' }] });

			expect(data.brandGate).toBe(true);
			expect(data.orgBrands).toEqual([expect.objectContaining({ id: 'b-1', name: 'Acme' })]);
		}
	);

	it.each(['api-keys', 'team', 'referrals', 'profile', 'appearance', 'project', 'brand'])(
		'senza brand, la sezione %s resta aperta',
		async (section) => {
			const { data } = await loadWithoutBrand(section);

			expect(data.brandGate).toBe(false);
		}
	);

	it('le chiavi API e gli inviti si leggono per org anche senza brand', async () => {
		const { data, ops } = await loadWithoutBrand('api-keys', {
			api_keys: [{ id: 'k-1' }],
			orgs_invites: [{ id: 'inv-1' }]
		});

		expect(ops).toEqual(expect.arrayContaining([
			{ table: 'api_keys', column: 'org_id', value: 'org-1' },
			{ table: 'orgs_invites', column: 'org_id', value: 'org-1' }
		]));
		expect(data.apiKeys).toEqual([{ id: 'k-1' }]);
		expect(data.isOwner).toBe(true);
	});
});
