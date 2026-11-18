import { describe, it, expect, vi, beforeEach } from 'vitest';


import { load } from '$lib/server/settings/shell';

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
});

describe('settings +layout.server load', () => {
	it('reads org-level orgs_invites', async () => {
		const supabase = fakeSupabase({
			social_accounts: [],
			api_keys: [],
			orgs_invites: [{ id: 'inv-1', email: 'a@b.com', accepted_at: null, created_at: '2026-01-01' }]
		});

		const data = await (load as (e: unknown) => Promise<Record<string, unknown>>)({
			parent: async () => ({ org: ORG }),
			url: new URL('https://feega.test/p/x/settings/team'),
			locals: { supabase }
		});

		const ops = (supabase as unknown as { __ops: any[] }).__ops;
		expect(ops.some((o) => o.table === 'orgs_invites' && o.column === 'org_id' && o.value === 'org-1')).toBe(
			true
		);
		expect(data.invites).toEqual([{ id: 'inv-1', email: 'a@b.com', accepted_at: null, created_at: '2026-01-01' }]);
	});

	async function loadSection(section: string, rows: Record<string, unknown[]> = {}) {
		const supabase = fakeSupabase(rows);
		const data = await (load as (e: unknown) => Promise<Record<string, unknown>>)({
			parent: async () => ({ org: ORG }),
			url: new URL(`https://feega.test/p/x/settings/${section}`),
			locals: { supabase }
		});
		return { data, ops: (supabase as unknown as { __ops: any[] }).__ops };
	}

	it('le chiavi API e gli inviti si leggono per org', async () => {
		const { data, ops } = await loadSection('api-keys', {
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
