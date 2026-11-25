import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudSubscriptionActive } from '$lib/server/stripe';

export async function orgHasCloud(db: SupabaseClient, orgId: string): Promise<boolean> {
  const { data } = await db.from('orgs').select('stripe_subscription_id').eq('id', orgId).maybeSingle();
  const subscriptionId = (data as { stripe_subscription_id: string | null } | null)?.stripe_subscription_id;

  return subscriptionId ? cloudSubscriptionActive(subscriptionId) : false;
}
