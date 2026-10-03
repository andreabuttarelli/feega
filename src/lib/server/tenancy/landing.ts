import type { Cookies } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { ensureProfile, recordTermsAcceptance } from '$lib/server/repos/profiles';
import { acceptInvite } from '$lib/server/tenancy/bootstrap';
import { ENTRY_DEPS, EntryVia, homePathFor } from '$lib/server/tenancy/entry';
import { ORG_COOKIE, LAST_PROJECT_COOKIE } from '$lib/server/tenancy/context';
import { CURRENT_TERMS_VERSION } from '$lib/legal-links';
import { takeCampaign } from '$lib/server/onboarding/campaign-cookie';

export const INVITE_PARAM = 'invite_token';
export const INVITE_ERROR_PARAM = 'invite_error';

export type LandingDeps = {
  ensureProfile: typeof ensureProfile;
  recordTermsAcceptance: typeof recordTermsAcceptance;
  acceptInvite: typeof acceptInvite;
  homePathFor: typeof homePathFor;
};

const LANDING_DEPS: LandingDeps = { ensureProfile, recordTermsAcceptance, acceptInvite, homePathFor };

async function recordFirstAcceptance(db: Db, deps: LandingDeps, userId: string, termsAcceptedAt: string | null) {
  if (termsAcceptedAt) return;
  await deps.recordTermsAcceptance(db, userId, CURRENT_TERMS_VERSION);
}

export function inviteTokenIn(params: URLSearchParams | FormData): string | null {
  const token = params.get(INVITE_PARAM);
  return typeof token === 'string' && token ? token : null;
}

export async function landingPath(
  db: Db,
  user: User,
  cookies: Cookies,
  inviteToken: string | null,
  deps: LandingDeps = LANDING_DEPS
): Promise<string> {
  const profile = await deps.ensureProfile(db, user);
  await recordFirstAcceptance(db, deps, user.id, profile.termsAcceptedAt);

  if (!inviteToken) {
    return deps.homePathFor(db, ENTRY_DEPS, user, cookies.get(ORG_COOKIE) ?? null, cookies.get(LAST_PROJECT_COOKIE) ?? null, takeCampaign(cookies));
  }

  const result = await deps.acceptInvite({ token: inviteToken, userId: user.id, email: user.email ?? '' });
  if (result.outcome !== 'accepted') {
    return `/login?${INVITE_ERROR_PARAM}=${result.outcome}`;
  }

  return deps.homePathFor(db, ENTRY_DEPS, user, result.orgId, null, null, EntryVia.Invite);
}
