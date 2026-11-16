import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

// Il modulo `dazero-provider` non esiste nel build aperto: si dichiara assente lanciando. Nel
// bundle esbuild del worker il corpo di un modulo gira UNA volta sola — dopo il primo throw (che
// il catch qui sotto assorbe) ogni import successivo restituisce un namespace vuoto invece di
// rilanciare, quindi `dazeroBillingProvider` arriva `undefined`.
vi.mock('./dazero-provider', () => ({ dazeroBillingProvider: undefined }));

describe('billingProvider()', () => {
	it('refuses every spend when the provider module exports nothing', async () => {
		const { billingProvider } = await import('./index');
		const { BillingUnavailableError } = await import('$lib/billing/contract');
		const provider = await billingProvider();

		await expect(provider.gate({ brandId: 'brand-1' })).rejects.toBeInstanceOf(BillingUnavailableError);
	});
});

describe('billingProvider() with the real dazero-provider present', () => {
	it('picks the dazero provider instead of falling back to open', async () => {
		vi.resetModules();
		vi.doUnmock('./dazero-provider');
		vi.doMock('$lib/server/credits', () => ({
			gateCreditsCore: async () => {},
			gateOrgCreditsCore: async () => {}
		}));

		const { billingProvider } = await import('./index');
		const provider = await billingProvider();

		expect(provider.kind).toBe('dazero');
	});
});
