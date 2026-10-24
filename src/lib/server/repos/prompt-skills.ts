import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { Outcome, type Actor } from '$lib/server/repos/effects';
import type { PromptSkill } from '$lib/canvas/prompt-skills';

const TABLE = 'prompt_skills';
const COLUMNS = 'id, name, body';
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);
const UNIQUE_VIOLATION = '23505';
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME = 48;
const MAX_BODY = 4000;

export type SkillWritten = { outcome: Outcome.Ok; skill: PromptSkill } | { outcome: Exclude<Outcome, Outcome.Ok>; problems?: string[] };

type Row = { id: string; name: string; body: string };
type DbError = { code?: string } | null;

const untyped = (db: Db) => db as unknown as SupabaseClient;
const toSkill = (row: Row): PromptSkill => ({ id: row.id, name: row.name, body: row.body });
const missing = (error: DbError) => Boolean(error && MISSING_TABLE_CODES.has(error.code ?? ''));

function failure(error: DbError): SkillWritten {
  if (missing(error)) {
    return { outcome: Outcome.Unavailable };
  }
  if (error?.code === UNIQUE_VIOLATION) {
    return { outcome: Outcome.NameTaken };
  }
  throw error;
}

export async function listPromptSkills(db: Db, orgId: string): Promise<PromptSkill[] | null> {
  const { data, error } = await untyped(db).from(TABLE).select(COLUMNS).eq('org_id', orgId).is('deleted_at', null).order('name');
  if (missing(error)) {
    return null;
  }
  if (error) {
    throw error;
  }
  return ((data ?? []) as Row[]).map(toSkill);
}

export async function writePromptSkill(db: Db, orgId: string, actor: Actor, input: { name?: unknown; body?: unknown } | null): Promise<SkillWritten> {
  const name = typeof input?.name === 'string' ? input.name : '';
  const body = typeof input?.body === 'string' ? input.body.trim() : '';
  if (!NAME.test(name) || name.length > MAX_NAME) {
    return { outcome: Outcome.Invalid, problems: ['name: kebab-case, at most 48 characters'] };
  }
  if (!body || body.length > MAX_BODY) {
    return { outcome: Outcome.Invalid, problems: ['body: between 1 and 4000 characters'] };
  }

  const { data: existing, error: findError } = await untyped(db).from(TABLE).select('id').eq('org_id', orgId).eq('name', name).is('deleted_at', null).maybeSingle();
  if (findError) {
    return failure(findError);
  }

  const query = existing
    ? untyped(db).from(TABLE).update({ body, updated_at: new Date().toISOString() }).eq('org_id', orgId).eq('id', (existing as { id: string }).id)
    : untyped(db).from(TABLE).insert({ org_id: orgId, name, body, actor_kind: actor.kind, actor_id: actor.id, agent_key: actor.agentKey ?? null });
  const { data, error } = await query.select(COLUMNS).single();
  if (error) {
    return failure(error);
  }
  return { outcome: Outcome.Ok, skill: toSkill(data as Row) };
}

export async function deletePromptSkill(db: Db, orgId: string, id: string): Promise<Outcome> {
  const { data, error } = await untyped(db).from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('org_id', orgId).eq('id', id).is('deleted_at', null).select('id');
  if (missing(error)) {
    return Outcome.Unavailable;
  }
  if (error) {
    throw error;
  }
  return data?.length ? Outcome.Ok : Outcome.NotFound;
}
