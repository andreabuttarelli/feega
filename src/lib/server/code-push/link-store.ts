import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { linkSchema, type CodeLink } from './link';
import type { PushLock } from './push-lock';

const LINKS = 'frame_code_links';
const LOCKS = 'git_push_locks';
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);
const UNIQUE_VIOLATION = '23505';
const LOCK_TTL_MS = 2 * 60_000;

type DbError = { code?: string } | null;
type Row = Record<string, unknown>;

export type LinkStore = {
  read: (nodeId: string) => Promise<CodeLink | null>;
  save: (nodeId: string, link: CodeLink) => Promise<boolean>;
  remove: (nodeId: string) => Promise<boolean>;
};

type Scope = { orgId: string; userId: string; projectId: string };

const untyped = (db: Db) => db as unknown as SupabaseClient;
const missing = (error: DbError) => Boolean(error && MISSING_TABLE_CODES.has(error.code ?? ''));

const COLUMN_OF: Record<keyof CodeLink, string> = {
  source: 'source',
  repo: 'repo',
  appRoot: 'app_root',
  entryKind: 'entry_kind',
  entry: 'entry',
  role: 'role',
  route: 'route',
  routeParams: 'route_params',
  baseBranch: 'base_branch',
  baseSha: 'base_sha',
  files: 'files',
  pushBranch: 'push_branch',
  pushSha: 'push_sha',
  pushParent: 'push_parent',
  pushTouched: 'push_touched',
  pullNumber: 'pull_number',
  writable: 'writable',
  restored: 'restored'
};

const FIELDS = Object.entries(COLUMN_OF) as [keyof CodeLink, string][];

const WRITTEN_ONLY_WHEN_SET = new Set<keyof CodeLink>(['restored']);

const written = ([field]: [keyof CodeLink, string], link: CodeLink) => !WRITTEN_ONLY_WHEN_SET.has(field) || link[field] !== undefined;

export const rowOf = (link: CodeLink): Row => Object.fromEntries(FIELDS.filter((f) => written(f, link)).map(([field, column]) => [column, link[field] ?? null]));

export const linkOf = (row: Row): CodeLink | null => {
  const parsed = linkSchema.safeParse(Object.fromEntries(FIELDS.filter(([, column]) => row[column] !== null && row[column] !== undefined).map(([field, column]) => [field, row[column]])));
  return parsed.success ? parsed.data : null;
};

export function linkStore(db: Db, scope: Scope): LinkStore {
  const table = () => untyped(db).from(LINKS);
  return {
    read: async (nodeId) => {
      const { data, error } = await table().select('*').eq('org_id', scope.orgId).eq('node_id', nodeId).maybeSingle();
      if (missing(error)) {
        return null;
      }
      if (error) {
        throw error;
      }
      return data ? linkOf(data as Row) : null;
    },
    save: async (nodeId, link) => {
      const row = { ...rowOf(link), node_id: nodeId, org_id: scope.orgId, project_id: scope.projectId, created_by: scope.userId, updated_at: new Date().toISOString() };
      const { error } = await table().upsert(row, { onConflict: 'node_id' });
      if (missing(error)) {
        return false;
      }
      if (error) {
        throw error;
      }
      return true;
    },
    remove: async (nodeId) => {
      const { data, error } = await table().delete().eq('org_id', scope.orgId).eq('node_id', nodeId).select('node_id');
      if (missing(error)) {
        return false;
      }
      if (error) {
        throw error;
      }
      return (data ?? []).length > 0;
    }
  };
}

export function dbLock(db: Db, scope: Scope, now: () => number = Date.now): PushLock {
  const table = () => untyped(db).from(LOCKS);
  return {
    acquire: async (key) => {
      await table().delete().eq('org_id', scope.orgId).eq('lock_key', key).lt('expires_at', new Date(now()).toISOString());
      const { error } = await table().insert({ org_id: scope.orgId, lock_key: key, holder: scope.userId, expires_at: new Date(now() + LOCK_TTL_MS).toISOString() });
      if (!error || missing(error)) {
        return true;
      }
      if (error.code === UNIQUE_VIOLATION) {
        return false;
      }
      throw error;
    },
    release: async (key) => {
      await table().delete().eq('org_id', scope.orgId).eq('lock_key', key).eq('holder', scope.userId);
    }
  };
}
