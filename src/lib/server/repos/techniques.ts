import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import type { Technique } from '$lib/canvas/technique';

const TABLE = 'techniques';
const COLUMNS = 'id, name, version, plan, inputs, outputs';
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);
const UNIQUE_VIOLATION = '23505';
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME = 48;

export enum TechniqueOutcome {
  Ok = 'ok',
  Unavailable = 'unavailable',
  NotFound = 'not_found',
  Invalid = 'invalid',
  NameTaken = 'name_taken'
}

export type StoredTechnique = Technique & { id: string; name: string; version: number };

export type TechniqueWritten = { outcome: TechniqueOutcome.Ok; technique: StoredTechnique } | { outcome: Exclude<TechniqueOutcome, TechniqueOutcome.Ok>; problems?: string[] };

type Row = { id: string; name: string; version: number; plan: Technique['plan']; inputs: Technique['inputs']; outputs: Technique['outputs'] };
type DbError = { code?: string } | null;

const untyped = (db: Db) => db as unknown as SupabaseClient;
const missing = (error: DbError) => Boolean(error && MISSING_TABLE_CODES.has(error.code ?? ''));
const toTechnique = (row: Row): StoredTechnique => ({ id: row.id, name: row.name, version: row.version, plan: row.plan, inputs: row.inputs, outputs: row.outputs });

function failure(error: DbError): TechniqueWritten {
  if (missing(error)) {
    return { outcome: TechniqueOutcome.Unavailable };
  }
  if (error?.code === UNIQUE_VIOLATION) {
    return { outcome: TechniqueOutcome.NameTaken };
  }
  throw error;
}

export async function listTechniques(db: Db, orgId: string): Promise<StoredTechnique[] | null> {
  const { data, error } = await untyped(db).from(TABLE).select(COLUMNS).eq('org_id', orgId).is('deleted_at', null).order('name');
  if (missing(error)) {
    return null;
  }
  if (error) {
    throw error;
  }
  return ((data ?? []) as Row[]).map(toTechnique);
}

export async function findTechnique(db: Db, orgId: string, id: string): Promise<StoredTechnique | null> {
  const { data, error } = await untyped(db).from(TABLE).select(COLUMNS).eq('org_id', orgId).eq('id', id).is('deleted_at', null).maybeSingle();
  if (missing(error)) {
    return null;
  }
  if (error) {
    throw error;
  }
  return data ? toTechnique(data as Row) : null;
}

export async function saveTechnique(db: Db, orgId: string, actor: Actor, input: { name: string; technique: Technique }): Promise<TechniqueWritten> {
  if (!NAME.test(input.name) || input.name.length > MAX_NAME) {
    return { outcome: TechniqueOutcome.Invalid, problems: ['name: kebab-case, at most 48 characters'] };
  }

  const { data: existing, error: findError } = await untyped(db).from(TABLE).select('id, version').eq('org_id', orgId).eq('name', input.name).is('deleted_at', null).maybeSingle();
  if (findError) {
    return failure(findError);
  }

  const body = { plan: input.technique.plan, inputs: input.technique.inputs, outputs: input.technique.outputs };
  const current = existing as { id: string; version: number } | null;
  const query = current
    ? untyped(db).from(TABLE).update({ ...body, version: current.version + 1, updated_at: new Date().toISOString() }).eq('org_id', orgId).eq('id', current.id)
    : untyped(db).from(TABLE).insert({ org_id: orgId, name: input.name, ...body, actor_kind: actor.kind, actor_id: actor.id, agent_key: actor.agentKey ?? null });
  const { data, error } = await query.select(COLUMNS).single();
  if (error) {
    return failure(error);
  }
  return { outcome: TechniqueOutcome.Ok, technique: toTechnique(data as Row) };
}

export async function deleteTechnique(db: Db, orgId: string, id: string): Promise<TechniqueOutcome> {
  const { data, error } = await untyped(db).from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('org_id', orgId).eq('id', id).is('deleted_at', null).select('id');
  if (missing(error)) {
    return TechniqueOutcome.Unavailable;
  }
  if (error) {
    throw error;
  }
  return data?.length ? TechniqueOutcome.Ok : TechniqueOutcome.NotFound;
}
