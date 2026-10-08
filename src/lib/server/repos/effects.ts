import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { applyEdits, lintFrag, parseEffect, type ShaderParam, type TextEdit } from '@feega/shader-fx';

const TABLE = 'effects';
const COLUMNS = 'id, org_id, name, version, frag, params, check_state, check_problems, cost_ms, updated_at';
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);
const UNIQUE_VIOLATION = '23505';
const FIRST_VERSION = 1;

export enum CheckState {
  Unchecked = 'unchecked',
  Passed = 'passed',
  Failed = 'failed'
}

export type StoredEffect = {
  id: string;
  name: string;
  version: number;
  frag: string;
  params: ShaderParam[];
  check: { state: CheckState; problems: string[]; costMs: number | null };
  updatedAt: string;
};

export type Actor = { kind: 'user' | 'agent'; id: string; agentKey?: string };

export enum Outcome {
  Ok = 'ok',
  Unavailable = 'unavailable',
  NotFound = 'not_found',
  Conflict = 'conflict',
  Invalid = 'invalid',
  NameTaken = 'name_taken'
}

export type Written = { outcome: Outcome.Ok; effect: StoredEffect } | { outcome: Exclude<Outcome, Outcome.Ok>; problems?: string[] };

type Row = {
  id: string;
  name: string;
  version: number;
  frag: string;
  params: ShaderParam[];
  check_state: CheckState;
  check_problems: string[];
  cost_ms: number | null;
  updated_at: string;
};

type DbError = { code?: string; message?: string } | null;

const untyped = (db: Db) => db as unknown as SupabaseClient;

const missing = (error: DbError) => Boolean(error && MISSING_TABLE_CODES.has(error.code ?? ''));

function toEffect(row: Row): StoredEffect {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    frag: row.frag,
    params: row.params ?? [],
    check: { state: row.check_state, problems: row.check_problems ?? [], costMs: row.cost_ms },
    updatedAt: row.updated_at
  };
}

function failure(error: DbError): Written {
  if (missing(error)) {
    return { outcome: Outcome.Unavailable };
  }
  if (error?.code === UNIQUE_VIOLATION) {
    return { outcome: Outcome.NameTaken };
  }

  throw error;
}

function checked(input: unknown) {
  const parsed = parseEffect(input);
  if (!parsed.ok) {
    return { ok: false as const, problems: parsed.problems };
  }

  const problems = lintFrag(parsed.effect.frag, parsed.effect.params).map((p) => `${p.rule}: ${p.message}`);
  const check_state = problems.length ? CheckState.Failed : CheckState.Unchecked;
  return { ok: true as const, effect: parsed.effect, columns: { check_state, check_problems: problems, cost_ms: null } };
}

export async function listEffects(db: Db, orgId: string): Promise<StoredEffect[] | null> {
  const { data, error } = await untyped(db).from(TABLE).select(COLUMNS).eq('org_id', orgId).is('deleted_at', null).order('name');
  if (missing(error)) {
    return null;
  }
  if (error) {
    throw error;
  }

  return ((data ?? []) as Row[]).map(toEffect);
}

export async function findEffect(db: Db, orgId: string, id: string): Promise<StoredEffect | null> {
  const { data, error } = await untyped(db).from(TABLE).select(COLUMNS).eq('org_id', orgId).eq('id', id).is('deleted_at', null).maybeSingle();
  if (missing(error)) {
    return null;
  }
  if (error) {
    throw error;
  }

  return data ? toEffect(data as Row) : null;
}

export async function findEffectByName(db: Db, orgId: string, name: string): Promise<StoredEffect | null> {
  const { data, error } = await untyped(db).from(TABLE).select(COLUMNS).eq('org_id', orgId).eq('name', name).is('deleted_at', null).maybeSingle();
  if (missing(error)) {
    return null;
  }
  if (error) {
    throw error;
  }

  return data ? toEffect(data as Row) : null;
}

export async function createEffect(db: Db, orgId: string, actor: Actor, input: unknown): Promise<Written> {
  const valid = checked(input);
  if (!valid.ok) {
    return { outcome: Outcome.Invalid, problems: valid.problems };
  }

  const { data, error } = await untyped(db)
    .from(TABLE)
    .insert({ org_id: orgId, ...valid.effect, ...valid.columns, version: FIRST_VERSION, actor_kind: actor.kind, actor_id: actor.id, agent_key: actor.agentKey ?? null })
    .select(COLUMNS)
    .single();
  if (error) {
    return failure(error);
  }

  return { outcome: Outcome.Ok, effect: toEffect(data as Row) };
}

export type EffectPatch = { version: number; frag?: string; params?: ShaderParam[]; edits?: TextEdit[] };

export async function patchEffect(db: Db, orgId: string, id: string, patch: EffectPatch): Promise<Written> {
  const current = await findEffect(db, orgId, id);
  if (!current) {
    return { outcome: Outcome.NotFound };
  }
  if (current.version !== patch.version) {
    return { outcome: Outcome.Conflict };
  }

  const edited = applyEdits(patch.frag ?? current.frag, patch.edits ?? []);
  if (!edited.ok) {
    return { outcome: Outcome.Invalid, problems: [edited.problem] };
  }

  const valid = checked({ name: current.name, frag: edited.text, params: patch.params ?? current.params });
  if (!valid.ok) {
    return { outcome: Outcome.Invalid, problems: valid.problems };
  }

  const { data, error } = await untyped(db)
    .from(TABLE)
    .update({ frag: valid.effect.frag, params: valid.effect.params, ...valid.columns, version: patch.version + 1, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('id', id)
    .eq('version', patch.version)
    .select(COLUMNS);
  if (error) {
    return failure(error);
  }

  const [row] = (data ?? []) as Row[];
  return row ? { outcome: Outcome.Ok, effect: toEffect(row) } : { outcome: Outcome.Conflict };
}

export async function recordCheck(db: Db, orgId: string, id: string, version: number, check: { state: CheckState; problems: string[]; costMs: number | null }): Promise<boolean> {
  const { data, error } = await untyped(db)
    .from(TABLE)
    .update({ check_state: check.state, check_problems: check.problems, cost_ms: check.costMs })
    .eq('org_id', orgId)
    .eq('id', id)
    .eq('version', version)
    .select('id');
  if (error) {
    throw error;
  }

  return Boolean(data?.length);
}

export async function deleteEffect(db: Db, orgId: string, id: string): Promise<Outcome> {
  const { data, error } = await untyped(db)
    .from(TABLE)
    .update({ deleted_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id');
  if (missing(error)) {
    return Outcome.Unavailable;
  }
  if (error) {
    throw error;
  }

  return data?.length ? Outcome.Ok : Outcome.NotFound;
}
