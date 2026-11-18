import type { SupabaseClient } from '@supabase/supabase-js';

export type OrgBilling = {
	orgId: string;
	/** Name Stripe shows the org on its own customer record — read once, at customer creation. */
	orgName: string;
	customerId: string | null;
	subscriptionId: string | null;
};

type OrgRow = {
	id: string;
	name: string;
	stripe_customer_id: string | null;
	stripe_subscription_id: string | null;
};

export async function orgBillingById(
	supabase: SupabaseClient,
	orgId: string
): Promise<OrgBilling | null> {
	const { data: orgData } = await supabase
		.from('orgs')
		.select('id, name, stripe_customer_id, stripe_subscription_id')
		.eq('id', orgId)
		.maybeSingle();
	const org = orgData as OrgRow | null;
	if (!org) return null;

	return {
		orgId: org.id,
		orgName: org.name,
		customerId: org.stripe_customer_id,
		subscriptionId: org.stripe_subscription_id
	};
}

/**
 * Billing authority, not org access: only the owner reaches the payment pages. Written out instead of leaned on RLS because the
 * API-key path runs as service role, where RLS proves nothing.
 */
export async function isOrgOwner(
	supabase: SupabaseClient,
	orgId: string,
	userId: string
): Promise<boolean> {
	const { data } = await supabase
		.from('orgs_members')
		.select('role')
		.eq('org_id', orgId)
		.eq('user_id', userId)
		.maybeSingle();
	return (data as { role?: string } | null)?.role === 'owner';
}
