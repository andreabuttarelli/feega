import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cronAuthorized } from '$lib/server/cron-auth';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { SeatSync, syncSeats } from '$lib/server/team/seat-billing';

const USE_PATH = 'src/routes/api/v1/billing/seats/reconcile';

export const GET: RequestHandler = async ({ request }) => {
  if (!cronAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const use = SERVICE_ROLE_USES.find((u) => u.path.startsWith(USE_PATH))!;
  const db = createServiceRoleDb(use);
  const { data, error } = await (db as unknown as SupabaseClient).from('orgs').select('id').not('stripe_subscription_id', 'is', null);
  if (error) {
    throw error;
  }

  let synced = 0;
  const failed: string[] = [];
  for (const { id } of (data ?? []) as { id: string }[]) {
    const outcome = await syncSeats(db, id);
    synced += outcome === SeatSync.Synced ? 1 : 0;
    if (outcome === SeatSync.Failed) {
      failed.push(id);
    }
  }

  return json({ synced, failed });
};
