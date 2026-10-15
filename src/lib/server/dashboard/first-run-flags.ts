import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { readTourSeen } from '$lib/server/repos/profiles';
import { TourState, tourStateOf } from '$lib/onboarding/tour';
import { outdatedTermsVersion } from '$lib/terms-notice';

export type FirstRunFlags = { termsNoticeVersion: string | null; tour: TourState };

const NOBODY: FirstRunFlags = { termsNoticeVersion: null, tour: TourState.Seen };

export async function firstRunFlags(db: Db | null, user: User | null): Promise<FirstRunFlags> {
  if (!db || !user) {
    return NOBODY;
  }

  const [terms, tourSeen] = await Promise.all([
    db.from('profiles').select('terms_version').eq('id', user.id).maybeSingle(),
    readTourSeen(db, user.id)
  ]);

  return {
    termsNoticeVersion: outdatedTermsVersion(terms.data?.terms_version ?? null),
    tour: tourStateOf({ createdAt: user.created_at, seen: tourSeen })
  };
}
