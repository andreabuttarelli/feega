import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingUnavailableError } from '$lib/billing/contract';

const swallowed: string[] = [];
vi.mock('$lib/server/swallow', () => ({
	swallow: (reason: string) => {
		swallowed.push(reason);
	}
}));

const exempt = { on: false };
vi.mock('./ai-log', () => ({ isCreditExempt: () => exempt.on }));

const balance = { value: 100 as number | Error };
const brandRow = { value: { id: 'brand-1', org_id: 'org-1' } as { id: string; org_id: string } | null };

vi.mock('./supabase-admin', () => ({
	createAdminClient: () => ({
		from: () => ({
			select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: brandRow.value, error: null }) }) })
		}),
		rpc: async () => (balance.value instanceof Error ? { data: null, error: { message: balance.value.message } } : { data: balance.value, error: null })
	})
}));

import { gateCreditsCore, gateOrgCreditsCore, CreditsExhaustedError } from './credits';

beforeEach(() => {
	swallowed.length = 0;
	exempt.on = false;
	balance.value = 100;
	brandRow.value = { id: 'brand-1', org_id: 'org-1' };
});

describe('a gate that cannot read the balance refuses the spend', () => {
	it('refuses when the ledger cannot be read, and says so', async () => {
		balance.value = new Error('ledger unreachable');

		await expect(gateCreditsCore('brand-1')).rejects.toBeInstanceOf(BillingUnavailableError);
		expect(swallowed).toHaveLength(1);
		expect(swallowed[0]).toContain('brand-1');
	});

	it('refuses an org with no brand the same way: free orgs are not let through either', async () => {
		balance.value = new Error('function credit_gate does not exist');

		await expect(gateOrgCreditsCore('org-free')).rejects.toBeInstanceOf(BillingUnavailableError);
		expect(swallowed[0]).toContain('org-free');
	});

	it('refuses a brand that resolves to no org: nobody to bill', async () => {
		brandRow.value = null;

		await expect(gateCreditsCore('brand-ghost')).rejects.toBeInstanceOf(BillingUnavailableError);
	});

	it('reads the balance on every spend: a pool emptied a moment ago is seen at once', async () => {
		await gateOrgCreditsCore('org-1');
		balance.value = 0;

		await expect(gateOrgCreditsCore('org-1')).rejects.toBeInstanceOf(CreditsExhaustedError);
	});

	it('a one-time system flow stays exempt', async () => {
		exempt.on = true;
		balance.value = new Error('ledger unreachable');

		await expect(gateCreditsCore('brand-1')).resolves.toBeUndefined();
	});
});
