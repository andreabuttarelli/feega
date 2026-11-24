import { error, fail, redirect } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';
import { readVerdictInput, setVerdict, VerdictOutcome } from '$lib/server/cloud/revisions';
import { namesOf, roleIn, sessionById } from '$lib/server/cloud/sessions';
import { isSid } from '$lib/server/cloud/sid';
import { stashReturn } from '$lib/server/cloud/return-path';
import { VisitKind, visit } from '$lib/server/cloud/visit';
import { onboardingPathFor } from '$lib/server/onboarding/onboarding';
import { ORG_COOKIE } from '$lib/server/tenancy/context';

const SEE_OTHER = 303;
const NOT_FOUND = 404;
const FORBIDDEN = 403;
const SERVER_ERROR = 500;
const UNAUTHORIZED = 401;
const BAD_REQUEST = 400;
const LOGIN_PATH = '/login';

export const load: PageServerLoad = async ({ params, url, cookies, locals: { safeGetSession, db } }) => {
  const here = `${url.pathname}${url.search}`;
  const { user } = await safeGetSession();
  const client = user ? await db() : null;
  if (!user || !client) {
    stashReturn(cookies, here);
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

export const actions: Actions = {
  verdict: async ({ params, request, locals: { safeGetSession, db } }) => {
    const { user } = await safeGetSession();
    const client = user ? await db() : null;
    if (!user || !client) {
      return fail(UNAUTHORIZED, { error: 'signed_out' });
    }

    const supabase = client as unknown as SupabaseClient;
    const form = await request.formData();
    const input = readVerdictInput({ verdict: form.get('verdict'), note: form.get('note') });
    const session = isSid(params.id) ? await sessionById(supabase, params.id) : null;
    const role = session ? await roleIn(supabase, session, user.id) : null;
    if (!input || !session || !role) {
      return fail(session && role ? BAD_REQUEST : NOT_FOUND, { error: 'invalid_verdict' });
    }

    const name = (await namesOf(supabase, [user.id])).get(user.id) ?? 'Someone';
    const outcome = await setVerdict(supabase, session, String(form.get('revisionId') ?? ''), { id: user.id, name, role }, input);
    if (outcome !== VerdictOutcome.Set) {
      return fail(outcome === VerdictOutcome.OwnRevision ? FORBIDDEN : NOT_FOUND, { error: outcome });
    }

    return { decided: input.verdict };
  }
};
