import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { EntryKind, linkKey, linkSchema, type CodeLink } from './link';
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
  all: (nodeId: string) => Promise<CodeLink[]>;
  inProject: () => Promise<CodeLink[]>;
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
  beforePoster: 'before_poster',
  variantOf: 'variant_of',
  keptSha: 'kept_sha'
};

const FIELDS = Object.entries(COLUMN_OF) as [keyof CodeLink, string][];

export const rowOf = (link: CodeLink): Row => Object.fromEntries(FIELDS.map(([field, column]) => [column, link[field] ?? null]));

export const linkOf = (row: Row): CodeLink | null => {
  const parsed = linkSchema.safeParse(Object.fromEntries(FIELDS.filter(([, column]) => row[column] !== null && row[column] !== undefined).map(([field, column]) => [field, row[column]])));
  return parsed.success ? parsed.data : null;
};

export const primaryOf = (links: CodeLink[]): CodeLink | null => links.find((l) => l.entryKind === EntryKind.Page) ?? links[0] ?? null;

export function linkStore(db: Db, scope: Scope): LinkStore {
  const table = () => untyped(db).from(LINKS);
  const all = async (nodeId: string) => {
    const { data, error } = await table().select('*').eq('org_id', scope.orgId).eq('node_id', nodeId).order('created_at');
    if (missing(error)) {
      return [];
    }
    if (error) {
      throw error;
    }
    return ((data ?? []) as Row[]).map(linkOf).filter((l): l is CodeLink => l !== null);
  };
  const inProject = async () => {
    const { data, error } = await table().select('*').eq('org_id', scope.orgId).eq('project_id', scope.projectId);
    if (missing(error)) {
      return [];
    }
    if (error) {
      throw error;
    }
    return ((data ?? []) as Row[]).map(linkOf).filter((l): l is CodeLink => l !== null);
  };
  return {
    all,
    inProject,
    read: async (nodeId) => primaryOf(await all(nodeId)),
    save: async (nodeId, link) => {
      const row = { ...rowOf(link), entry_key: linkKey(link), node_id: nodeId, org_id: scope.orgId, project_id: scope.projectId, created_by: scope.userId, updated_at: new Date().toISOString() };
      const { error } = await table().upsert(row, { onConflict: 'node_id,entry_key' });
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

export async function keepBeforePoster(db: Db, scope: Pick<Scope, 'orgId'>, nodeId: string, assetId: string): Promise<void> {
  const { error } = await untyped(db).from(LINKS).update({ before_poster: assetId }).eq('org_id', scope.orgId).eq('node_id', nodeId).is('before_poster', null);
  if (error && !missing(error)) {
    throw error;
  }
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
