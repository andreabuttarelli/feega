import { beforeEach, describe, expect, it, vi } from 'vitest';

// The fallback to the permissive provider is the shape of the incident that left AI ungated in
// production for a week: it is correct behaviour for a self-hosted fork, and a revenue defect
// everywhere else. These tests pin WHICH of the two it reports.

const swallowed: string[] = [];
vi.mock('$lib/server/swallow', () => ({
	swallow: (reason: string) => {
		swallowed.push(reason);
	}
}));

beforeEach(() => {
	swallowed.length = 0;
	vi.resetModules();
});

describe('billingProvider() without the paid provider refuses to spend, and says so', () => {
	it('reports when the paid provider throws on load', async () => {
		vi.doMock('$env/dynamic/private', () => ({ env: {} }));
		vi.doMock('./dazero-provider', () => {
			throw new Error('not available in the open build');
		});

		const { billingProvider } = await import('./index');
		const { BillingUnavailableError } = await import('$lib/billing/contract');
		const provider = await billingProvider();

		await expect(provider.gate('credits', { orgId: 'org-free' })).rejects.toBeInstanceOf(BillingUnavailableError);
		expect(swallowed).toHaveLength(1);
		expect(swallowed[0]).toMatch(/billing/i);
	});

	it('reports when the paid provider loads but exports nothing', async () => {
		vi.doMock('$env/dynamic/private', () => ({ env: {} }));
		vi.doMock('./dazero-provider', () => ({ dazeroBillingProvider: undefined }));

		const { billingProvider } = await import('./index');
		const { BillingUnavailableError } = await import('$lib/billing/contract');
		const provider = await billingProvider();

		await expect(provider.gate('credits', { brandId: 'brand-1' })).rejects.toBeInstanceOf(BillingUnavailableError);
		expect(swallowed).toHaveLength(1);
	});

	it('local mode is open on purpose: file-only, the user pays with their own keys', async () => {
		vi.doMock('$env/dynamic/private', () => ({ env: {} }));
		vi.doMock('$lib/server/local/local-mode', () => ({ localStore: () => ({}) }));
		vi.doMock('./dazero-provider', () => {
			throw new Error('must not be asked in local mode');
		});

		const { billingProvider } = await import('./index');
		const provider = await billingProvider();

		expect(provider.kind).toBe('open');
		expect(swallowed).toEqual([]);
		vi.doUnmock('$lib/server/local/local-mode');
	});

	it('stays silent when BILLING_PROVIDER=open asked for it', async () => {
		vi.doMock('$env/dynamic/private', () => ({ env: { BILLING_PROVIDER: 'open' } }));
		vi.doMock('./dazero-provider', () => {
			throw new Error('not available in the open build');
		});

		const { billingProvider } = await import('./index');
		const provider = await billingProvider();

		expect(provider.kind).toBe('open');
		expect(swallowed).toEqual([]);
	});

	it('stays silent when the paid provider is there', async () => {
		vi.doMock('$env/dynamic/private', () => ({ env: {} }));
		vi.doMock('./dazero-provider', () => ({
			dazeroBillingProvider: { kind: 'dazero', gate: async () => {} }
		}));

		const { billingProvider } = await import('./index');
		const provider = await billingProvider();

		expect(provider.kind).toBe('dazero');
		expect(swallowed).toEqual([]);
	});

	it('reports once, not on all 29 gate call sites', async () => {
		vi.doMock('$env/dynamic/private', () => ({ env: {} }));
		vi.doMock('./dazero-provider', () => {
			throw new Error('not available in the open build');
		});

		const { billingProvider } = await import('./index');
		await billingProvider();
		await billingProvider();
		await billingProvider();

		expect(swallowed).toHaveLength(1);
	});
});
