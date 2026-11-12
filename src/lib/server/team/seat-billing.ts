import type { Db } from '$lib/server/db/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EDITOR_ROLES } from '$lib/org-roles';
import { PLAN } from '$lib/credit-ladder';
import type { SeatProration, SeatSubscription } from '$lib/server/stripe';

export enum SeatSync {
  Unbilled = 'unbilled',
  Legacy = 'legacy',
  Unchanged = 'unchanged',
  Synced = 'synced',
  Charged = 'charged',
  Failed = 'failed'
}

export enum SeatGate {
  Free = 'free',
  Charged = 'charged',
  Included = 'included',
  PastDue = 'past_due'
}

export enum SeatBilling {
  Free = 'free',
  PerEditor = 'per_editor',
  Legacy = 'legacy',
  Unknown = 'unknown'
}

export type SeatStatus = {
  editors: number;
  paid: boolean;
  billing: SeatBilling;
  pastDue: boolean;
  grandfathered: boolean;
  endsAt: string | null;
  pricePerEditor: number;
};

export type SeatCounts = { quantity: number; paid: number; editors: number };

export type SeatStep = { quantity: number; proration: SeatProration };

type OrgSeats = {
  stripe_subscription_id?: string | null;
  editor_seats_grandfathered_at?: string | null;
  seats_paid?: number | null;
  seats_paid_until?: string | null;
};

export const RECONCILE_BATCH = 40;

const NONE = 'none' as SeatProration;
const INVOICE = 'always_invoice' as SeatProration;
const PAST_DUE = 'past_due';

const client = (db: Db) => db as unknown as SupabaseClient;

const stripeApi = () => import('$lib/server/stripe');

export async function editorCount(db: Db, orgId: string): Promise<number> {
  const { data, error } = await client(db).from('orgs_members').select('role').eq('org_id', orgId).in('role', [...EDITOR_ROLES]);
  if (error) {
    throw error;
  }
  return (data ?? []).length;
}

async function orgSeats(db: Db, orgId: string): Promise<OrgSeats> {
  const { data, error } = await client(db)
    .from('orgs')
    .select('stripe_subscription_id, editor_seats_grandfathered_at, seats_paid, seats_paid_until')
    .eq('id', orgId)
    .maybeSingle();
  if (error) {
    throw new Error(`seat state unreadable for ${orgId}: ${error.message}`);
  }
  return (data as OrgSeats | null) ?? {};
}

function paidThisPeriod(org: OrgSeats, quantity: number, now: Date): number {
  const until = org.seats_paid_until ? new Date(org.seats_paid_until).getTime() : 0;
  return org.seats_paid != null && until > now.getTime() ? org.seats_paid : quantity;
}

export function seatSteps({ quantity, paid, editors }: SeatCounts): SeatStep[] {
  if (editors === quantity) {
    return [];
  }
  if (editors < quantity) {
    return [{ quantity: editors, proration: NONE }];
  }

  const steps: SeatStep[] = [];
  const restored = Math.min(editors, paid);
  if (restored > quantity) {
    steps.push({ quantity: restored, proration: NONE });
  }
  if (editors > Math.max(quantity, paid)) {
    steps.push({ quantity: editors, proration: INVOICE });
  }
  return steps;
}

export async function syncSeats(db: Db, orgId: string, now = new Date()): Promise<SeatSync> {
  const org = await orgSeats(db, orgId);
  const subscriptionId = org.stripe_subscription_id;
  if (!subscriptionId) {
    return SeatSync.Unbilled;
  }
  const editors = await editorCount(db, orgId);

  try {
    const { seatSubscription, setSeatQuantity } = await stripeApi();
    const sub = await seatSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`subscription ${subscriptionId} has no item`);
    }
    if (!sub.perEditor) {
      return SeatSync.Legacy;
    }

    const steps = seatSteps({ quantity: sub.quantity, paid: paidThisPeriod(org, sub.quantity, now), editors });
    for (const step of steps) {
      await setSeatQuantity(subscriptionId, sub.itemId, step.quantity, step.proration);
    }
    if (!steps.length) {
      return SeatSync.Unchanged;
    }
    return steps.some((s) => s.proration === INVOICE) ? SeatSync.Charged : SeatSync.Synced;
  } catch (e) {
    console.error('[seats] quantity not synced, the reconcile cron retries', orgId, e);
    return SeatSync.Failed;
  }
}

const GATE_OF = (sub: SeatSubscription): SeatGate => {
  if (sub.status === PAST_DUE) {
    return SeatGate.PastDue;
  }
  return sub.perEditor ? SeatGate.Charged : SeatGate.Included;
};

export async function editorSeatGate(db: Db, orgId: string): Promise<SeatGate> {
  const subscriptionId = (await orgSeats(db, orgId)).stripe_subscription_id;
  if (!subscriptionId) {
    return SeatGate.Free;
  }

  const { seatSubscription } = await stripeApi();
  const sub = await seatSubscription(subscriptionId);
  if (!sub) {
    throw new Error(`subscription ${subscriptionId} has no item`);
  }
  return GATE_OF(sub);
}

async function subscriptionOrNull(subscriptionId: string): Promise<SeatSubscription | null> {
  try {
    const { seatSubscription } = await stripeApi();
    return await seatSubscription(subscriptionId);
  } catch {
    return null;
  }
}

export async function seatStatus(db: Db, orgId: string): Promise<SeatStatus> {
  const [org, editors] = await Promise.all([orgSeats(db, orgId), editorCount(db, orgId)]);
  const subscriptionId = org.stripe_subscription_id ?? null;
  const sub = subscriptionId ? await subscriptionOrNull(subscriptionId) : null;
  const billing = !subscriptionId ? SeatBilling.Free : !sub ? SeatBilling.Unknown : sub.perEditor ? SeatBilling.PerEditor : SeatBilling.Legacy;

  return {
    editors,
    paid: !!subscriptionId,
    billing,
    pastDue: sub?.status === PAST_DUE,
    grandfathered: !!org.editor_seats_grandfathered_at,
    endsAt: sub?.endsAt ?? null,
    pricePerEditor: PLAN.price
  };
}
