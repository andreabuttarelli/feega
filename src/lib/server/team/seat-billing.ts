import type { Db } from '$lib/server/db/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EDITOR_ROLES } from '$lib/org-roles';
import { PLAN } from '$lib/credit-ladder';

export enum SeatSync {
  Synced = 'synced',
  Unbilled = 'unbilled',
  Failed = 'failed'
}

const client = (db: Db) => db as unknown as SupabaseClient;

export async function editorCount(db: Db, orgId: string): Promise<number> {
  const { data, error } = await client(db).from('orgs_members').select('role').eq('org_id', orgId).in('role', [...EDITOR_ROLES]);
  if (error) {
    throw error;
  }
  return (data ?? []).length;
}

export type SeatStatus = { editors: number; paid: boolean; grandfathered: boolean; endsAt: string | null; pricePerEditor: number };

type OrgSeats = { stripe_subscription_id?: string | null; editor_seats_grandfathered_at?: string | null };

async function orgSeats(db: Db, orgId: string): Promise<OrgSeats> {
  const { data } = await client(db).from('orgs').select('stripe_subscription_id, editor_seats_grandfathered_at').eq('id', orgId).maybeSingle();
  return (data as OrgSeats | null) ?? {};
}

async function subscriptionOf(db: Db, orgId: string): Promise<string | null> {
  return (await orgSeats(db, orgId)).stripe_subscription_id ?? null;
}

async function endOf(subscriptionId: string | null): Promise<string | null> {
  if (!subscriptionId) {
    return null;
  }
  try {
    const { scheduledEnd } = await import('$lib/server/stripe');
    return await scheduledEnd(subscriptionId);
  } catch {
    return null;
  }
}

export async function seatStatus(db: Db, orgId: string): Promise<SeatStatus> {
  const [org, editors] = await Promise.all([orgSeats(db, orgId), editorCount(db, orgId)]);
  const subscriptionId = org.stripe_subscription_id ?? null;

  return {
    editors,
    paid: !!subscriptionId,
    grandfathered: !!org.editor_seats_grandfathered_at,
    endsAt: await endOf(subscriptionId),
    pricePerEditor: PLAN.price
  };
}

export async function syncSeats(db: Db, orgId: string): Promise<SeatSync> {
  const subscriptionId = await subscriptionOf(db, orgId);
  if (!subscriptionId) {
    return SeatSync.Unbilled;
  }

  try {
    const { setSeatQuantity } = await import('$lib/server/stripe');
    await setSeatQuantity(subscriptionId, await editorCount(db, orgId));
    return SeatSync.Synced;
  } catch (e) {
    console.error('[seats] quantity not synced, the reconcile cron retries', orgId, e);
    return SeatSync.Failed;
  }
}
