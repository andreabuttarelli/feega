import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { openSecret, sealSecret } from '$lib/server/secrets/seal';
import type { CloudProvider, TokenSet } from './cloud';

const TABLE = 'user_cloud_tokens';
const SEAL_CONTEXT = 'feega:cloud-tokens';
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

type DbError = { code?: string } | null;

export type CloudTokenStore = {
  read: (provider: CloudProvider) => Promise<TokenSet | null>;
  save: (provider: CloudProvider, tokens: TokenSet) => Promise<boolean>;
  remove: (provider: CloudProvider) => Promise<void>;
};

const untyped = (db: Db) => db as unknown as SupabaseClient;
const missing = (error: DbError) => Boolean(error && MISSING_TABLE_CODES.has(error.code ?? ''));

function parse(text: string | null): TokenSet | null {
  try {
    return text ? (JSON.parse(text) as TokenSet) : null;
  } catch {
    return null;
  }
}

export function cloudTokenStore(db: Db, userId: string): CloudTokenStore {
  const table = () => untyped(db).from(TABLE);

  return {
    read: async (provider) => {
      const { data, error } = await table().select('tokens_sealed').eq('user_id', userId).eq('provider', provider).maybeSingle();
      if (missing(error)) {
        return null;
      }
      if (error) {
        throw error;
      }
      return data ? parse(openSecret(SEAL_CONTEXT, (data as { tokens_sealed: string }).tokens_sealed)) : null;
    },
    save: async (provider, tokens) => {
      const row = { user_id: userId, provider, tokens_sealed: sealSecret(SEAL_CONTEXT, JSON.stringify(tokens)), updated_at: new Date().toISOString() };
      const { error } = await table().upsert(row, { onConflict: 'user_id,provider' });
      if (missing(error)) {
        return false;
      }
      if (error) {
        throw error;
      }
      return true;
    },
    remove: async (provider) => {
      const { error } = await table().delete().eq('user_id', userId).eq('provider', provider);
      if (error && !missing(error)) {
        throw error;
      }
    }
  };
}
