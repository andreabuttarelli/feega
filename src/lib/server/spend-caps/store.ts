import type { Db } from '$lib/server/db/client';
import { CapReset, CapScope, type SpendCap } from './policy';

type Untyped = { from: (table: string) => any };

const untyped = (db: Db) => db as unknown as Untyped;

type CapRow = { scope: CapScope; project_id: string | null; cap_usd: number | string; reset: CapReset };

const SPEND_PAGE = 1000;
const SPEND_MAX_PAGES = 50;

const toCap = (row: CapRow): SpendCap => ({ scope: row.scope, projectId: row.project_id, capUsd: Number(row.cap_usd), reset: row.reset });

export async function readCaps(db: Db, orgId: string): Promise<SpendCap[] | null> {
  const { data, error } = await untyped(db).from('org_spend_caps').select('scope, project_id, cap_usd, reset').eq('org_id', orgId);
  return error ? null : ((data ?? []) as CapRow[]).map(toCap);
}

export async function removeCap(db: Db, scope: { orgId: string; scope: CapScope; projectId: string | null }): Promise<boolean> {
  let query = untyped(db).from('org_spend_caps').delete().eq('org_id', scope.orgId).eq('scope', scope.scope);
  query = scope.projectId ? query.eq('project_id', scope.projectId) : query.is('project_id', null);
  return !(await query).error;
}

export async function saveCap(db: Db, input: { orgId: string; cap: SpendCap }): Promise<boolean> {
  if (!(await removeCap(db, { orgId: input.orgId, scope: input.cap.scope, projectId: input.cap.projectId }))) {
    return false;
  }

  const { error } = await untyped(db)
    .from('org_spend_caps')
    .insert({ org_id: input.orgId, scope: input.cap.scope, project_id: input.cap.projectId, cap_usd: input.cap.capUsd, reset: input.cap.reset });
  return !error;
}

export type SpendQuery = { orgId: string; userId?: string; projectId?: string; since: Date | null };

export async function spentUsd(db: Db, query: SpendQuery): Promise<number> {
  let total = 0;

  for (let page = 0; page < SPEND_MAX_PAGES; page++) {
    let rows = untyped(db).from('ai_calls').select('cost_usd').eq('org_id', query.orgId);
    rows = query.userId ? rows.eq('actor_id', query.userId) : rows;
    rows = query.projectId ? rows.eq('project_id', query.projectId) : rows;
    rows = query.since ? rows.gte('created_at', query.since.toISOString()) : rows;

    const { data, error } = await rows.order('created_at', { ascending: true }).range(page * SPEND_PAGE, (page + 1) * SPEND_PAGE - 1);
    if (error) {
      throw new Error(`ai_calls sum failed: ${error.message}`);
    }

    const batch = (data ?? []) as { cost_usd: number | null }[];
    total += batch.reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);
    if (batch.length < SPEND_PAGE) {
      break;
    }
  }
  return total;
}
