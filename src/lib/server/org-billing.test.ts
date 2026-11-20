import { describe, expect, it } from 'vitest';
import { orgBillingById } from './org-billing';

type Row = Record<string, unknown>;

function makeDb(org: Row | null) {
	const chain = {
		select: () => chain,
		eq: () => chain,
		maybeSingle: async () => ({ data: org, error: null })
	};
	return { from: () => chain };
}

const ORG = {
	id: 'org-1',
	name: 'Acme',
	stripe_customer_id: 'cus_org',
	stripe_subscription_id: 'sub_org'
};

describe('orgBillingById', () => {
	it('reads the Stripe customer/subscription off orgs directly', async () => {
		const billing = await orgBillingById(makeDb(ORG) as never, 'org-1');

		expect(billing).toEqual({
			orgId: 'org-1',
			orgName: 'Acme',
			customerId: 'cus_org',
			subscriptionId: 'sub_org'
		});
	});

	it('reports no customer when the org never paid', async () => {
		const billing = await orgBillingById(
			makeDb({ ...ORG, stripe_customer_id: null, stripe_subscription_id: null }) as never,
			'org-1'
		);

		expect(billing).toMatchObject({ customerId: null, subscriptionId: null });
	});

	it('is null when the org row cannot be read', async () => {
		expect(await orgBillingById(makeDb(null) as never, 'org-1')).toBeNull();
	});
});
