import { beforeEach, describe, expect, it, vi } from 'vitest';

const swallowed: { reason: string; err: unknown }[] = [];
vi.mock('$lib/server/swallow', () => ({
	swallow: (reason: string, err?: unknown) => {
		swallowed.push({ reason, err });
	}
}));

vi.mock('./ai-log', () => ({ isCreditExempt: () => false }));

beforeEach(() => {
	swallowed.length = 0;
	vi.resetModules();
});

describe('gateOrgCreditsCore fail-open', () => {
	it('still allows the action when the ledger cannot be read', async () => {
		vi.doMock('./supabase-admin', () => ({
			createAdminClient: () => {
				throw new Error('supabase unreachable');
			}
		}));

		const { gateOrgCreditsCore } = await import('./credits');
		await expect(gateOrgCreditsCore('org-1')).resolves.toBeUndefined();
	});

	it('reports the org it could not evaluate instead of failing open in silence', async () => {
		vi.doMock('./supabase-admin', () => ({
			createAdminClient: () => {
				throw new Error('supabase unreachable');
			}
		}));

		const { gateOrgCreditsCore } = await import('./credits');
		await gateOrgCreditsCore('org-1');

		expect(swallowed).toHaveLength(1);
		expect(swallowed[0].reason).toContain('org-1');
	});
});
