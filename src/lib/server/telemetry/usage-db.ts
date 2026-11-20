import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import type { UsageRow, UsageSink } from './usage';

const USAGE_USE = SERVICE_ROLE_USES.find((use) => use.path.startsWith('src/lib/server/telemetry/usage-db.ts'));

type UsageTable = { insert: (rows: UsageRow[]) => PromiseLike<{ error: unknown }> };

export const dbSink: UsageSink = async (rows) => {
  if (!USAGE_USE) {
    throw new Error('usage_events service role use not declared');
  }

  const db = createServiceRoleDb(USAGE_USE) as unknown as { from: (table: 'usage_events') => UsageTable };
  const { error } = await db.from('usage_events').insert(rows);
  if (error) {
    throw error;
  }
};
