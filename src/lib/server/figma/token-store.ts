import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { openSecret, sealSecret } from '$lib/server/secrets/seal';

const TABLE = 'user_figma_tokens';
const SEAL_CONTEXT = 'feega:figma-token';
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

type DbError = { code?: string } | null;

export type FigmaTokenStore = {
  read: () => Promise<string | null>;
  save: (token: string) => Promise<boolean>;
  remove: () => Promise<void>;
};

const untyped = (db: Db) => db as unknown as SupabaseClient;
const missing = (error: DbError) => Boolean(error && MISSING_TABLE_CODES.has(error.code ?? ''));

export function figmaTokenStore(db: Db, userId: string): FigmaTokenStore {
  const table = () => untyped(db).from(TABLE);

  return {
    read: async () => {
      const { data, error } = await table().select('token_sealed').eq('user_id', userId).maybeSingle();
      if (missing(error)) {
        return null;
      }
      if (error) {
        throw error;
      }
      return data ? openSecret(SEAL_CONTEXT, (data as { token_sealed: string }).token_sealed) : null;
    },
    save: async (token) => {
      const { error } = await table().upsert({ user_id: userId, token_sealed: sealSecret(SEAL_CONTEXT, token), updated_at: new Date().toISOString() });
      if (missing(error)) {
        return false;
      }
      if (error) {
        throw error;
      }
      return true;
    },
    remove: async () => {
      const { error } = await table().delete().eq('user_id', userId);
      if (error && !missing(error)) {
        throw error;
      }
    }
  };
}
