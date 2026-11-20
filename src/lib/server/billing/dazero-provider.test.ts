import { describe, expect, it, vi } from 'vitest';

const gateOrgCreditsCoreMock = vi.fn(async () => {});
vi.mock('$lib/server/credits', () => ({
	gateOrgCreditsCore: gateOrgCreditsCoreMock,
	creditQuota: (plan: string | null | undefined) => (plan === 'pro' ? 4000 : 400)
}));
vi.mock('$lib/server/plans', () => ({
	postQuota: (plan: string | null | undefined) => (plan === 'pro' ? 90 : 15),
	plansAbove: (plan: string | null | undefined) => (plan === 'pro' ? [] : [{ key: 'pro' }]),
	isTopPlan: (plan: string | null | undefined) => plan === 'pro'
}));

describe('dazeroBillingProvider', () => {
	it('gate("credits", ...) calls the real enforcement, not a no-op', async () => {
		const { dazeroBillingProvider } = await import('./dazero-provider');
		await dazeroBillingProvider.gate('credits', { orgId: 'org-1' });
		expect(gateOrgCreditsCoreMock).toHaveBeenCalledWith('org-1');
	});

	it('gate("credits", ...) propagates a denial from gateOrgCreditsCore', async () => {
		gateOrgCreditsCoreMock.mockRejectedValueOnce(new Error('exhausted'));
		const { dazeroBillingProvider } = await import('./dazero-provider');
		await expect(dazeroBillingProvider.gate('credits', { orgId: 'org-1' })).rejects.toThrow(
			'exhausted'
		);
	});

	it('quota("credits", ...) reads the real per-plan quota', async () => {
		const { dazeroBillingProvider } = await import('./dazero-provider');
		await expect(dazeroBillingProvider.quota('credits', { plan: 'pro' })).resolves.toBe(
			4000
		);
		await expect(dazeroBillingProvider.quota('credits', { plan: null })).resolves.toBe(
			400
		);
	});

	it('quota("posts", ...) reads the real per-plan quota', async () => {
		const { dazeroBillingProvider } = await import('./dazero-provider');
		await expect(dazeroBillingProvider.quota('posts', { plan: 'pro' })).resolves.toBe(
			90
		);
	});



	it('plansAbove/isTopPlan delegate to the real plan ladder', async () => {
		const { dazeroBillingProvider } = await import('./dazero-provider');
		expect(dazeroBillingProvider.plansAbove('pro')).toEqual([]);
		expect(dazeroBillingProvider.isTopPlan('pro')).toBe(true);
		expect(dazeroBillingProvider.isTopPlan(null)).toBe(false);
	});
});
