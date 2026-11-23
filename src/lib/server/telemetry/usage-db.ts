import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import type { UsageRow, UsageSink } from './usage';

const USAGE_USE = SERVICE_ROLE_USES.find((use) => use.path.startsWith('src/lib/server/telemetry/usage-db.ts'));

const MISSING_FUNNEL_CODES = ['PGRST204', '42703', '23514'];
const LEGACY_EVENTS = ['session_start', 'edit', 'session_end'];
const SUPPORT_EVENT = 'support_action';

type Insert = (rows: unknown[]) => PromiseLike<{ error: { code?: string } | null }>;
type Reduce = (rows: UsageRow[]) => UsageRow[];

const withoutSupport: Reduce = (rows) => {
  if (!rows.some((row) => row.event === SUPPORT_EVENT)) {
    return rows;
  }

  return rows.filter((row) => row.event !== SUPPORT_EVENT);
};

const withoutFunnel: Reduce = (rows) =>
  rows
    .filter((row) => LEGACY_EVENTS.includes(row.event))
    .map(({ framework: _framework, edit_kind: _editKind, signed_in: _signedIn, step: _step, tier: _tier, ...legacy }) => legacy as UsageRow);

const FALLBACKS: Reduce[] = [withoutSupport, withoutFunnel];

export const makeSink =
  (insert: Insert): UsageSink =>
  async (rows) => {
    let sent = rows;
    let failure: { code?: string } | null = null;

    for (const reduce of [(all: UsageRow[]) => all, ...FALLBACKS]) {
      const batch = reduce(rows);
      if (batch === sent && failure) {
        continue;
      }
      if (batch.length === 0) {
        return;
      }

      const { error } = await insert(batch);
      if (!error) {
        return;
      }
      if (!MISSING_FUNNEL_CODES.includes(error.code ?? '')) {
        throw error;
      }

      sent = batch;
      failure = error;
    }

    throw failure;
  };

export const dbSink: UsageSink = async (rows) => {
  if (!USAGE_USE) {
    throw new Error('usage_events service role use not declared');
  }

  const db = createServiceRoleDb(USAGE_USE) as unknown as { from: (table: 'usage_events') => { insert: Insert } };
  await makeSink((batch) => db.from('usage_events').insert(batch))(rows);
};
