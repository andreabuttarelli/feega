import type { Cookies } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { ensureProfile, recordTermsAcceptance } from '$lib/server/repos/profiles';
import { acceptInvite } from '$lib/server/tenancy/bootstrap';
import { ENTRY_DEPS, homePathFor } from '$lib/server/tenancy/entry';
import { ORG_COOKIE } from '$lib/server/tenancy/context';
import { CURRENT_TERMS_VERSION } from '$lib/legal-links';
import { ProductEvent, track } from '$lib/server/product-events/track';
import { markSignedUp } from '$lib/server/core-usage';
import { onboardingPathFor } from '$lib/server/onboarding/onboarding';

export const INVITE_PARAM = 'invite_token';
export const INVITE_ERROR_PARAM = 'invite_error';

export type LandingDeps = {
  ensureProfile: typeof ensureProfile;
  recordTermsAcceptance: typeof recordTermsAcceptance;
  acceptInvite: typeof acceptInvite;
  homePathFor: typeof homePathFor;
  track: typeof track;
  onboardingPathFor: typeof onboardingPathFor;
};

const LANDING_DEPS: LandingDeps = { ensureProfile, recordTermsAcceptance, acceptInvite, homePathFor, track, onboardingPathFor };

async function recordFirstAcceptance(db: Db, deps: LandingDeps, userId: string, termsAcceptedAt: string | null) {
  if (termsAcceptedAt) {
    return;
  }
  await deps.recordTermsAcceptance(db, userId, CURRENT_TERMS_VERSION);
  await deps.track(ProductEvent.SignupCompleted, { userId }, {});
  markSignedUp(userId, new Date().toISOString());
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
    const chosenOrgId = cookies.get(ORG_COOKIE) ?? null;
    const home = await deps.homePathFor(db, ENTRY_DEPS, user, chosenOrgId);
    return (await deps.onboardingPathFor(db, user, chosenOrgId, home)) ?? home;
  }

  const result = await deps.acceptInvite({ token: inviteToken, userId: user.id, email: user.email ?? '' });
  if (result.outcome !== 'accepted') {
    return `/login?${INVITE_ERROR_PARAM}=${result.outcome}`;
  }

  await deps.track(ProductEvent.TeamInviteAccepted, { userId: user.id, orgId: result.orgId }, { role: result.role });

  const home = await deps.homePathFor(db, ENTRY_DEPS, user, result.orgId);
  return (await deps.onboardingPathFor(db, user, result.orgId, home)) ?? home;
}
