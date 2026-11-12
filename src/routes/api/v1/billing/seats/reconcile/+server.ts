import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cronAuthorized } from '$lib/server/cron-auth';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { SeatSync, syncSeats } from '$lib/server/team/seat-billing';

export const config = { maxDuration: 60 };

export const RECONCILE_BATCH = 40;

const USE_PATH = 'src/routes/api/v1/billing/seats/reconcile';
const HTTP_BAD_GATEWAY = 502;

export const GET: RequestHandler = async ({ request }) => {
  if (!cronAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const use = SERVICE_ROLE_USES.find((u) => u.path.startsWith(USE_PATH))!;
  const db = createServiceRoleDb(use);
  const client = db as unknown as SupabaseClient;
  const { data, error } = await client
    .from('orgs')
    .select('id')
    .not('stripe_subscription_id', 'is', null)
    .order('seats_checked_at', { ascending: true, nullsFirst: true })
    .limit(RECONCILE_BATCH);
  if (error) {
    throw error;
  }

  const outcomes: Partial<Record<SeatSync, number>> = {};
  const failed: string[] = [];
  for (const { id } of (data ?? []) as { id: string }[]) {
    const outcome = await syncSeats(db, id).catch(() => SeatSync.Failed);
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    if (outcome === SeatSync.Failed) {
      failed.push(id);
    }
    await client.from('orgs').update({ seats_checked_at: new Date().toISOString() }).eq('id', id);
  }

  return json({ checked: (data ?? []).length, outcomes, failed }, { status: failed.length ? HTTP_BAD_GATEWAY : 200 });
};
