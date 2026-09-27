import type { Cookies } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { ensureProfile } from '$lib/server/repos/profiles';
import { acceptInvite } from '$lib/server/tenancy/bootstrap';
import { ENTRY_DEPS, homePathFor } from '$lib/server/tenancy/entry';
import { ORG_COOKIE, LAST_PROJECT_COOKIE } from '$lib/server/tenancy/context';

export const INVITE_PARAM = 'invite_token';
export const INVITE_ERROR_PARAM = 'invite_error';

export type LandingDeps = {
  ensureProfile: typeof ensureProfile;
  acceptInvite: typeof acceptInvite;
  homePathFor: typeof homePathFor;
};

const LANDING_DEPS: LandingDeps = { ensureProfile, acceptInvite, homePathFor };

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
  if (!inviteToken) {
    return deps.homePathFor(db, ENTRY_DEPS, user, cookies.get(ORG_COOKIE) ?? null, cookies.get(LAST_PROJECT_COOKIE) ?? null);
  }

  await deps.ensureProfile(db, user);
  const result = await deps.acceptInvite({ token: inviteToken, userId: user.id, email: user.email ?? '' });
  if (result.outcome !== 'accepted') {
    return `/login?${INVITE_ERROR_PARAM}=${result.outcome}`;
  }

  return deps.homePathFor(db, ENTRY_DEPS, user, result.orgId, null);
}
