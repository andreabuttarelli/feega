import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { DASHBOARD_PATH, isReachable } from '$lib/app-routes';
import { ORG_COOKIE } from '$lib/server/tenancy/context';
import { onboardingPathFor } from '$lib/server/onboarding/onboarding';

const SEE_OTHER = 303;

export const load: LayoutServerLoad = async ({ url, cookies, locals: { safeGetSession, db } }) => {
  if (!isReachable(url.pathname)) {
    throw redirect(SEE_OTHER, DASHBOARD_PATH);
  }

  const { user } = await safeGetSession();
  const client = user ? await db() : null;
  if (!user || !client) {
    return;
  }

  const onboarding = await onboardingPathFor(client, user, cookies.get(ORG_COOKIE) ?? null, `${url.pathname}${url.search}`);
  if (onboarding) {
    throw redirect(SEE_OTHER, onboarding);
  }
};
