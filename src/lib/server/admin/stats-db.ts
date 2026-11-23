import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import type { Funnel, RetentionRaw, SignupRow, StatsSource, WeeklyRow } from './stats';

const STATS_USE = SERVICE_ROLE_USES.find((use) => use.path.startsWith('src/lib/server/admin/stats-db.ts'));

type Rpc = (fn: string) => PromiseLike<{ data: unknown; error: unknown }>;

async function call<T>(fn: string): Promise<T> {
  if (!STATS_USE) {
    throw new Error('admin stats service role use not declared');
  }

  const db = createServiceRoleDb(STATS_USE) as unknown as { rpc: Rpc };
  const { data, error } = await db.rpc(fn);
  if (error || data === null) {
    throw error ?? new Error(`${fn} returned nothing`);
  }
  return data as T;
}

export const statsDb: StatsSource = {
  weekly: () => call<WeeklyRow[]>('admin_usage_weekly_active'),
  retention: () => call<RetentionRaw[]>('admin_usage_retention'),
  funnel: async () => (await call<Funnel[]>('admin_usage_funnel'))[0],
  signups: () => call<SignupRow[]>('admin_signups_weekly')
};
