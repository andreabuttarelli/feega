import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import type { Actor } from './actor';

const TABLE = 'canvas_conflicts';
const COLUMNS = 'id, canvas_id, node_id, expected_version, actual_version, attempt, attempted, winning_event_id, actor_kind, actor_id, agent_key, resolution, resolved_at, created_at';
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

export enum Attempt {
  Replace = 'replace',
  Patch = 'patch',
  MotionHead = 'motion_head'
}

export enum Resolution {
  Mine = 'mine',
  Theirs = 'theirs'
}

export type RefusedWrite = {
  orgId: string;
  canvasId: string;
  nodeId: string;
  expectedVersion: number | null;
  actualVersion: number | null;
  attempt: Attempt;
  attempted: Record<string, unknown>;
  winningEventId: number | null;
  actor?: Actor;
};

export type CanvasConflict = {
  id: string;
  canvasId: string;
  nodeId: string;
  expectedVersion: number | null;
  actualVersion: number | null;
  attempt: Attempt;
  attempted: Record<string, unknown>;
  winningEventId: number | null;
  refused: Actor;
  resolution: Resolution | null;
  resolvedAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  canvas_id: string;
  node_id: string;
  expected_version: number | null;
  actual_version: number | null;
  attempt: Attempt;
  attempted: Record<string, unknown>;
  winning_event_id: number | null;
  actor_kind: Actor['kind'];
  actor_id: string | null;
  agent_key: string | null;
  resolution: Resolution | null;
  resolved_at: string | null;
  created_at: string;
};

type DbError = { code?: string } | null;

const untyped = (db: Db) => db as unknown as SupabaseClient;
const missing = (error: DbError) => Boolean(error && MISSING_TABLE_CODES.has(error.code ?? ''));

const toConflict = (row: Row): CanvasConflict => ({
  id: row.id,
  canvasId: row.canvas_id,
  nodeId: row.node_id,
  expectedVersion: row.expected_version,
  actualVersion: row.actual_version,
  attempt: row.attempt,
  attempted: row.attempted,
  winningEventId: row.winning_event_id,
  refused: { kind: row.actor_kind, id: row.actor_id, agentKey: row.agent_key },
  resolution: row.resolution,
  resolvedAt: row.resolved_at,
  createdAt: row.created_at
});

function unlessMissing(error: DbError) {
  if (error && !missing(error)) {
    throw error;
  }
}

export async function recordConflict(db: Db, refused: RefusedWrite): Promise<void> {
  const { error } = await untyped(db).from(TABLE).insert({
    org_id: refused.orgId,
    canvas_id: refused.canvasId,
    node_id: refused.nodeId,
    expected_version: refused.expectedVersion,
    actual_version: refused.actualVersion,
    attempt: refused.attempt,
    attempted: refused.attempted,
    winning_event_id: refused.winningEventId,
    actor_kind: refused.actor?.kind ?? 'system',
    actor_id: refused.actor?.id ?? null,
    agent_key: refused.actor?.agentKey ?? null
  });
  unlessMissing(error);
}

export async function listConflicts(db: Db, scope: { orgId: string; canvasId: string; limit: number }): Promise<CanvasConflict[]> {
  const { data, error } = await untyped(db).from(TABLE).select(COLUMNS).eq('org_id', scope.orgId).eq('canvas_id', scope.canvasId).order('created_at', { ascending: false }).limit(scope.limit);
  unlessMissing(error);
  return ((data ?? []) as Row[]).map(toConflict);
}

export async function findConflict(db: Db, scope: { orgId: string; canvasId: string; conflictId: string }): Promise<CanvasConflict | null> {
  const { data, error } = await untyped(db).from(TABLE).select(COLUMNS).eq('org_id', scope.orgId).eq('canvas_id', scope.canvasId).eq('id', scope.conflictId).maybeSingle();
  unlessMissing(error);
  return data ? toConflict(data as Row) : null;
}

export async function closeConflict(db: Db, input: { orgId: string; conflictId: string; resolution: Resolution; actor?: Actor }): Promise<boolean> {
  const { data, error } = await untyped(db)
    .from(TABLE)
    .update({ resolution: input.resolution, resolved_at: new Date().toISOString(), resolved_by: input.actor?.id ?? null })
    .eq('org_id', input.orgId)
    .eq('id', input.conflictId)
    .is('resolved_at', null)
    .select('id')
    .maybeSingle();
  unlessMissing(error);
  return Boolean(data);
}
