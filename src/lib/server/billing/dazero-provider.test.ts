import { describe, expect, it, vi } from 'vitest';

const gateCreditsCoreMock = vi.fn(async () => {});
const gateOrgCreditsCoreMock = vi.fn(async () => {});
vi.mock('$lib/server/credits', () => ({
	gateCreditsCore: gateCreditsCoreMock,
	gateOrgCreditsCore: gateOrgCreditsCoreMock
}));

describe('dazeroBillingProvider', () => {
	it('gates a brand through the real enforcement', async () => {
		const { dazeroBillingProvider } = await import('./dazero-provider');
		await dazeroBillingProvider.gate({ brandId: 'brand-1' });
		expect(gateCreditsCoreMock).toHaveBeenCalledWith('brand-1');
	});

	it('gates an org with no brand on the org balance', async () => {
		const { dazeroBillingProvider } = await import('./dazero-provider');
		await dazeroBillingProvider.gate({ orgId: 'org-1' });
		expect(gateOrgCreditsCoreMock).toHaveBeenCalledWith('org-1');
	});

	it('propagates a denial', async () => {
		gateCreditsCoreMock.mockRejectedValueOnce(new Error('exhausted'));
		const { dazeroBillingProvider } = await import('./dazero-provider');
		await expect(dazeroBillingProvider.gate({ brandId: 'brand-1' })).rejects.toThrow('exhausted');
	});
});
