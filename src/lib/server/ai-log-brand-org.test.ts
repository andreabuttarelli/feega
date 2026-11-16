import { describe, expect, it, vi } from 'vitest';

const rows: Record<string, unknown>[] = [];

vi.mock('./supabase-admin', () => ({
	createAdminClient: () => ({
		from: (table: string) => {
			if (table === 'brands') {
				return {
					select: (columns: string) => ({
						eq: () => ({
							maybeSingle: async () =>
								columns.split(',').map((c) => c.trim()).includes('plan')
									? { data: null, error: { code: '42703', message: 'column brands.plan does not exist' } }
									: { data: { org_id: 'org-of-brand' }, error: null }
						})
					})
				};
			}
			return {
				insert: (row: Record<string, unknown>) => ({
					select: () => ({
						single: async () => {
							rows.push(row);
							return { data: { id: row.id }, error: null };
						}
					})
				})
			};
		}
	})
}));

import { logAiCall, withBrandContext } from './ai-log';

describe('a brand-scoped call is billed to the brand\'s org', () => {
	it('lands on the org even though brands has no plan column', async () => {
		withBrandContext('brand-x', () => logAiCall({ label: 'enhance', provider: 'llm', ms: 5, ok: true, flatCostUsd: 0.01 }));

		await vi.waitFor(() => expect(rows).toHaveLength(1));
		expect(rows[0].org_id).toBe('org-of-brand');
	});
});
