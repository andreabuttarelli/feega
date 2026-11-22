import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { outdatedTermsVersion } from '$lib/terms-notice';

export type FirstRunFlags = { termsNoticeVersion: string | null; name: string | null };

const NOBODY: FirstRunFlags = { termsNoticeVersion: null, name: null };

const NAME_KEYS = ['full_name', 'name'] as const;

function metadataName(user: User): string | null {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const key = NAME_KEYS.find((k) => typeof metadata[k] === 'string' && metadata[k]);
  return key ? (metadata[key] as string) : null;
}

export async function firstRunFlags(db: Db | null, user: User | null): Promise<FirstRunFlags> {
  if (!db || !user) {
    return NOBODY;
  }

  const terms = await db.from('profiles').select('terms_version, name').eq('id', user.id).maybeSingle();

  return {
    termsNoticeVersion: outdatedTermsVersion(terms.data?.terms_version ?? null),
    name: terms.data?.name || metadataName(user)
  };
}
