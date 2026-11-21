import { error, redirect } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';
import { VisitKind, visit } from '$lib/server/cloud/visit';
import { onboardingPathFor } from '$lib/server/onboarding/onboarding';
import { stashOAuthReturn } from '$lib/server/oauth';
import { ORG_COOKIE } from '$lib/server/tenancy/context';

const SEE_OTHER = 303;
const NOT_FOUND = 404;
const FORBIDDEN = 403;
const SERVER_ERROR = 500;
const LOGIN_PATH = '/login';

export const load: PageServerLoad = async ({ params, url, cookies, locals: { safeGetSession, db } }) => {
  const here = `${url.pathname}${url.search}`;
  const { user } = await safeGetSession();
  const client = user ? await db() : null;
  if (!user || !client) {
    stashOAuthReturn(cookies, here);
    throw redirect(SEE_OTHER, LOGIN_PATH);
  }

  const onboarding = await onboardingPathFor(client, user, cookies.get(ORG_COOKIE) ?? null, here);
  if (onboarding) {
    throw redirect(SEE_OTHER, onboarding);
  }

  const secret = env.RELAY_SIGNING_SECRET;
  if (!secret) {
    throw error(SERVER_ERROR, 'Sessions are not configured');
  }

  const outcome = await visit(client as unknown as SupabaseClient, {
    sid: params.id,
    userId: user.id,
    next: url.searchParams.get('next'),
    secret,
    now: new Date()
  });

  if (outcome.kind === VisitKind.NotFound) {
    throw error(NOT_FOUND, 'Session not found');
  }
  if (outcome.kind === VisitKind.Removed) {
    throw error(FORBIDDEN, 'You were removed from this session');
  }
  if (outcome.kind === VisitKind.Enter) {
    throw redirect(SEE_OTHER, outcome.url);
  }

  return { sid: params.id, ...outcome.ended };
};
