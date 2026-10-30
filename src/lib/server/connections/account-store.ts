import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { LinkStatus, type Toolkit } from './account-links';

const TABLE = 'user_connected_accounts';
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

type DbError = { code?: string } | null;

export type StoredAccount = { accountId: string; status: LinkStatus; label: string | null };

export type AccountStore = {
  read: (toolkit: Toolkit) => Promise<StoredAccount | null>;
  save: (toolkit: Toolkit, account: StoredAccount) => Promise<boolean>;
  remove: (toolkit: Toolkit) => Promise<void>;
};

type Row = { connected_account_id: string; status: LinkStatus; account_label: string | null };

const untyped = (db: Db) => db as unknown as SupabaseClient;
const missing = (error: DbError) => Boolean(error && MISSING_TABLE_CODES.has(error.code ?? ''));

export function accountStore(db: Db, scope: { orgId: string; userId: string }): AccountStore {
  const table = () => untyped(db).from(TABLE);

  return {
    read: async (toolkit) => {
      const { data, error } = await table().select('connected_account_id, status, account_label').eq('org_id', scope.orgId).eq('user_id', scope.userId).eq('toolkit', toolkit).maybeSingle();
      if (missing(error)) {
        return null;
      }
      if (error) {
        throw error;
      }
      const row = data as Row | null;
      return row ? { accountId: row.connected_account_id, status: row.status, label: row.account_label } : null;
    },
    save: async (toolkit, account) => {
      const row = { org_id: scope.orgId, user_id: scope.userId, toolkit, connected_account_id: account.accountId, status: account.status, account_label: account.label, updated_at: new Date().toISOString() };
      const { error } = await table().upsert(row, { onConflict: 'org_id,user_id,toolkit' });
      if (missing(error)) {
        return false;
      }
      if (error) {
        throw error;
      }
      return true;
    },
    remove: async (toolkit) => {
      const { error } = await table().delete().eq('org_id', scope.orgId).eq('user_id', scope.userId).eq('toolkit', toolkit);
      if (error && !missing(error)) {
        throw error;
      }
    }
  };
}
