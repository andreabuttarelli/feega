import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { readTourSeen } from '$lib/server/repos/profiles';
import { TourState, tourStateOf } from '$lib/onboarding/tour';
import { outdatedTermsVersion } from '$lib/terms-notice';

export type FirstRunFlags = { termsNoticeVersion: string | null; tour: TourState; name: string | null };

const NOBODY: FirstRunFlags = { termsNoticeVersion: null, tour: TourState.Seen, name: null };

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

  const [terms, tourSeen] = await Promise.all([
    db.from('profiles').select('terms_version, name').eq('id', user.id).maybeSingle(),
    readTourSeen(db, user.id)
  ]);

  return {
    termsNoticeVersion: outdatedTermsVersion(terms.data?.terms_version ?? null),
    tour: tourStateOf({ createdAt: user.created_at, seen: tourSeen }),
    name: terms.data?.name || metadataName(user)
  };
}
