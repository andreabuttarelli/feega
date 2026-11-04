import type { Db } from '$lib/server/db/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export enum BillingTier {
  Free = 'free',
  Paid = 'paid'
}

export async function billingTierOf(db: Db, orgId: string): Promise<BillingTier> {
  const { data } = await (db as unknown as SupabaseClient).from('orgs').select('id, stripe_subscription_id').eq('id', orgId).maybeSingle();
  return (data as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id ? BillingTier.Paid : BillingTier.Free;
}
