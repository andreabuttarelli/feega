import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import type { UsageRow, UsageSink } from './usage';

const USAGE_USE = SERVICE_ROLE_USES.find((use) => use.path.startsWith('src/lib/server/telemetry/usage-db.ts'));

const MISSING_FUNNEL_CODES = ['PGRST204', '42703', '23514'];
const LEGACY_EVENTS = ['session_start', 'edit', 'session_end'];

type Insert = (rows: unknown[]) => PromiseLike<{ error: { code?: string } | null }>;

function withoutFunnel(rows: UsageRow[]) {
  return rows
    .filter((row) => LEGACY_EVENTS.includes(row.event))
    .map(({ framework: _framework, edit_kind: _editKind, signed_in: _signedIn, step: _step, tier: _tier, ...legacy }) => legacy);
}

export const makeSink =
  (insert: Insert): UsageSink =>
  async (rows) => {
    const { error } = await insert(rows);
    if (!error) {
      return;
    }
    if (!MISSING_FUNNEL_CODES.includes(error.code ?? '')) {
      throw error;
    }

    const legacy = withoutFunnel(rows);
    if (legacy.length === 0) {
      return;
    }

    const retry = await insert(legacy);
    if (retry.error) {
      throw retry.error;
    }
  };

export const dbSink: UsageSink = async (rows) => {
  if (!USAGE_USE) {
    throw new Error('usage_events service role use not declared');
  }

  const db = createServiceRoleDb(USAGE_USE) as unknown as { from: (table: 'usage_events') => { insert: Insert } };
  await makeSink((batch) => db.from('usage_events').insert(batch))(rows);
};
