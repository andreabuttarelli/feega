import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { parseLayoutSpec, type LayoutSpec } from '$lib/canvas/composition/spec';
import { Outcome, type Actor } from '$lib/server/repos/effects';

const TABLE = 'layouts';
const COLUMNS = 'id, org_id, name, version, kind, spec, updated_at';
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);
const UNIQUE_VIOLATION = '23505';
const FIRST_VERSION = 1;
const SPEC_KIND = 'spec';
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME = 48;

export type StoredLayout = { id: string; name: string; version: number; kind: typeof SPEC_KIND; spec: LayoutSpec; updatedAt: string };

export type LayoutWritten = { outcome: Outcome.Ok; layout: StoredLayout } | { outcome: Exclude<Outcome, Outcome.Ok>; problems?: string[] };

type Row = { id: string; name: string; version: number; kind: typeof SPEC_KIND; spec: LayoutSpec; updated_at: string };
type DbError = { code?: string } | null;

const untyped = (db: Db) => db as unknown as SupabaseClient;
const missing = (error: DbError) => Boolean(error && MISSING_TABLE_CODES.has(error.code ?? ''));
const toLayout = (row: Row): StoredLayout => ({ id: row.id, name: row.name, version: row.version, kind: row.kind, spec: row.spec, updatedAt: row.updated_at });

function failure(error: DbError): LayoutWritten {
  if (missing(error)) {
    return { outcome: Outcome.Unavailable };
  }
  if (error?.code === UNIQUE_VIOLATION) {
    return { outcome: Outcome.NameTaken };
  }
  throw error;
}

function validSpec(spec: unknown): { ok: true; spec: LayoutSpec } | { ok: false; problems: string[] } {
  const parsed = parseLayoutSpec(spec);
  return parsed.ok ? { ok: true, spec: spec as LayoutSpec } : parsed;
}

export async function listLayouts(db: Db, orgId: string): Promise<StoredLayout[] | null> {
  const { data, error } = await untyped(db).from(TABLE).select(COLUMNS).eq('org_id', orgId).is('deleted_at', null).order('name');
  if (missing(error)) {
    return null;
  }
  if (error) {
    throw error;
  }
  return ((data ?? []) as Row[]).map(toLayout);
}

async function findBy(db: Db, orgId: string, column: 'id' | 'name', value: string): Promise<StoredLayout | null> {
  const { data, error } = await untyped(db).from(TABLE).select(COLUMNS).eq('org_id', orgId).eq(column, value).is('deleted_at', null).maybeSingle();
  if (missing(error)) {
    return null;
  }
  if (error) {
    throw error;
  }
  return data ? toLayout(data as Row) : null;
}

export const findLayout = (db: Db, orgId: string, id: string) => findBy(db, orgId, 'id', id);

export async function patchLayout(db: Db, orgId: string, id: string, patch: { version: number; spec: unknown }): Promise<LayoutWritten> {
  const current = await findLayout(db, orgId, id);
  if (!current) {
    return { outcome: Outcome.NotFound };
  }
  if (current.version !== patch.version) {
    return { outcome: Outcome.Conflict };
  }

  const valid = validSpec(patch.spec);
  if (!valid.ok) {
    return { outcome: Outcome.Invalid, problems: valid.problems };
  }

  const { data, error } = await untyped(db)
    .from(TABLE)
    .update({ spec: valid.spec, version: patch.version + 1, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('id', id)
    .eq('version', patch.version)
    .select(COLUMNS);
  if (error) {
    return failure(error);
  }

  const [row] = (data ?? []) as Row[];
  return row ? { outcome: Outcome.Ok, layout: toLayout(row) } : { outcome: Outcome.Conflict };
}

export async function writeLayout(db: Db, orgId: string, actor: Actor, input: { name?: unknown; spec?: unknown } | null): Promise<LayoutWritten> {
  const name = typeof input?.name === 'string' ? input.name : '';
  if (!NAME.test(name) || name.length > MAX_NAME) {
    return { outcome: Outcome.Invalid, problems: ['name: kebab-case, at most 48 characters'] };
  }

  const valid = validSpec(input?.spec);
  if (!valid.ok) {
    return { outcome: Outcome.Invalid, problems: valid.problems };
  }

  const existing = await findBy(db, orgId, 'name', name);
  if (existing) {
    return patchLayout(db, orgId, existing.id, { version: existing.version, spec: valid.spec });
  }

  const { data, error } = await untyped(db)
    .from(TABLE)
    .insert({ org_id: orgId, name, kind: SPEC_KIND, spec: valid.spec, version: FIRST_VERSION, actor_kind: actor.kind, actor_id: actor.id, agent_key: actor.agentKey ?? null })
    .select(COLUMNS)
    .single();
  if (error) {
    return failure(error);
  }
  return { outcome: Outcome.Ok, layout: toLayout(data as Row) };
}

export async function deleteLayout(db: Db, orgId: string, id: string): Promise<Outcome> {
  const { data, error } = await untyped(db).from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('org_id', orgId).eq('id', id).is('deleted_at', null).select('id');
  if (missing(error)) {
    return Outcome.Unavailable;
  }
  if (error) {
    throw error;
  }
  return data?.length ? Outcome.Ok : Outcome.NotFound;
}
