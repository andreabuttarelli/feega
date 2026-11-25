import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { PRODUCT_COLUMNS, PRODUCT_EVENTS, type UsageRow, type UsageSink } from './usage';

const USAGE_USE = SERVICE_ROLE_USES.find((use) => use.path.startsWith('src/lib/server/telemetry/usage-db.ts'));

const MISSING_FUNNEL_CODES = ['PGRST204', '42703', '23514', '23503'];
const LEGACY_EVENTS = ['session_start', 'edit', 'session_end'];
const SUPPORT_EVENT = 'support_action';

type Insert = (rows: unknown[]) => PromiseLike<{ error: { code?: string } | null }>;
type Reduce = (rows: UsageRow[]) => UsageRow[];

const withoutProduct: Reduce = (rows) => {
  const known = rows.filter((row) => !(PRODUCT_EVENTS as readonly string[]).includes(row.event));
  const stripped = known.map((row) => {
    if (!PRODUCT_COLUMNS.some((column) => column in row)) {
      return row;
    }

    return Object.fromEntries(Object.entries(row).filter(([key]) => !PRODUCT_COLUMNS.includes(key))) as UsageRow;
  });
  const unchanged = stripped.length === rows.length && stripped.every((row, index) => row === rows[index]);

  return unchanged ? rows : stripped;
};

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

const FALLBACKS: Reduce[] = [withoutProduct, withoutSupport, withoutFunnel];

export const makeSink =
  (insert: Insert): UsageSink =>
  async (rows) => {
    let batch = rows;
    let failure: { code?: string } | null = null;

    for (const reduce of [(all: UsageRow[]) => all, ...FALLBACKS]) {
      const next = reduce(batch);
      if (next === batch && failure) {
        continue;
      }
      if (next.length === 0) {
        return;
      }

      batch = next;
      const { error } = await insert(batch);
      if (!error) {
        return;
      }
      if (!MISSING_FUNNEL_CODES.includes(error.code ?? '')) {
        throw error;
      }

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
