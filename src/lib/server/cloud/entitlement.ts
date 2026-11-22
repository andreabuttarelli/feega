import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { cloudSeatCount } from '$lib/server/stripe';

const SEPARATOR = ',';
const NO_SEATS = 0;

export function cloudOrgIds(): ReadonlySet<string> {
  const listed = (env.CLOUD_ORG_IDS ?? '').split(SEPARATOR).map((id) => id.trim());

  return new Set(listed.filter(Boolean));
}

function cloudPriceIds(): string[] {
  return [env.STRIPE_PRICE_CLOUD_MONTHLY, env.STRIPE_PRICE_CLOUD_ANNUAL].filter((id): id is string => Boolean(id));
}

export async function cloudSeats(db: SupabaseClient, orgId: string): Promise<number> {
  if (cloudOrgIds().has(orgId)) {
    return Infinity;
  }

  const priceIds = cloudPriceIds();
  if (!priceIds.length) {
    return NO_SEATS;
  }

  const { data } = await db.from('orgs').select('stripe_customer_id').eq('id', orgId).maybeSingle();
  const customerId = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customerId) {
    return NO_SEATS;
  }

  return cloudSeatCount(customerId, priceIds);
}

export async function cloudEntitled(db: SupabaseClient, orgId: string): Promise<boolean> {
  return (await cloudSeats(db, orgId)) > NO_SEATS;
}
