import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { NO_SESSION, type AppAccount, type AppAccountStore } from '$lib/server/web/app-browse';
import type { AppSession } from '$lib/server/web/browser';

const TABLE = 'app_accounts';
const COLUMNS = 'login_url, email, test_password, session, session_until';
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

type Row = { login_url: string; email: string; test_password: string; session: AppSession | null; session_until: string | null };
type DbError = { code?: string } | null;

export type AppAccountScope = { orgId: string; projectId: string; actor: Actor };

const untyped = (db: Db) => db as unknown as SupabaseClient;
const missing = (error: DbError) => Boolean(error && MISSING_TABLE_CODES.has(error.code ?? ''));

const toAccount = (row: Row): AppAccount => ({ loginUrl: row.login_url, email: row.email, password: row.test_password, session: row.session ?? NO_SESSION, sessionUntil: row.session_until ? Date.parse(row.session_until) : null });

export function appAccountStore(db: Db, scope: AppAccountScope): AppAccountStore {
  const table = () => untyped(db).from(TABLE);

  return {
    read: async () => {
      const { data, error } = await table().select(COLUMNS).eq('project_id', scope.projectId).eq('org_id', scope.orgId).maybeSingle();
      if (missing(error)) {
        return null;
      }
      if (error) {
        throw error;
      }
      return data ? toAccount(data as Row) : null;
    },
    save: async (account) => {
      const { error } = await table().upsert({
        project_id: scope.projectId,
        org_id: scope.orgId,
        login_url: account.loginUrl,
        email: account.email,
        test_password: account.password,
        session: account.session,
        session_until: account.sessionUntil === null ? null : new Date(account.sessionUntil).toISOString(),
        actor_kind: scope.actor.kind,
        actor_id: scope.actor.id,
        agent_key: scope.actor.agentKey ?? null,
        updated_at: new Date().toISOString()
      });
      if (error && !missing(error)) {
        throw error;
      }
    },
    forget: async () => {
      const { error } = await table().delete().eq('project_id', scope.projectId).eq('org_id', scope.orgId);
      if (error && !missing(error)) {
        throw error;
      }
    }
  };
}

export async function readAppAccount(db: Db, scope: Omit<AppAccountScope, 'actor'>): Promise<{ loginUrl: string; email: string; sessionUntil: number | null } | null> {
  const account = await appAccountStore(db, { ...scope, actor: { kind: 'user', id: null } }).read();
  return account ? { loginUrl: account.loginUrl, email: account.email, sessionUntil: account.sessionUntil } : null;
}
