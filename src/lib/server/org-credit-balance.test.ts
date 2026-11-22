import { beforeEach, describe, expect, it, vi } from 'vitest';
import { orgCreditBalance } from './credits';

const rpc = vi.fn();

beforeEach(() => {
	rpc.mockReset();
});

describe('orgCreditBalance', () => {
	it('reads org_credit_balance for the org', async () => {
		rpc.mockResolvedValue({ data: 250, error: null });
		const admin = { rpc } as never;

		const balance = await orgCreditBalance(admin, 'org-1');

		expect(rpc).toHaveBeenCalledWith('org_credit_balance', { _org_id: 'org-1' });
		expect(balance).toBe(250);
	});
});
