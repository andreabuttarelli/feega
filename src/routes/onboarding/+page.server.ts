import { fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ORG_COOKIE } from '$lib/server/tenancy/context';
import { NEXT_PARAM, OnboardingSave, readOnboarding, safeNext, saveOnboarding } from '$lib/server/onboarding/onboarding';
import type { Actions, PageServerLoad } from './$types';

const SEE_OTHER = 303;
const BAD_REQUEST = 400;

async function signedIn({ locals }: RequestEvent) {
  const { user } = await locals.safeGetSession();
  const db = user ? await locals.db() : null;
  if (!user || !db) {
    throw redirect(SEE_OTHER, '/login');
  }
  return { user, db };
}

export const load: PageServerLoad = async (event) => {
  const { user, db } = await signedIn(event);
  const next = safeNext(event.url.searchParams.get(NEXT_PARAM));
  const state = await readOnboarding(db, user, event.cookies.get(ORG_COOKIE) ?? null);

  if (!state.needsName && !state.needsOrg) {
    throw redirect(SEE_OTHER, next);
  }

  return { next, needsName: state.needsName, needsOrg: state.needsOrg, first: state.first, last: state.last, orgName: state.orgName };
};

export const actions: Actions = {
  save: async (event) => {
    const { user, db } = await signedIn(event);
    const next = safeNext(event.url.searchParams.get(NEXT_PARAM));
    const form = await event.request.formData();
    const input = {
      first: String(form.get('first') ?? ''),
      last: String(form.get('last') ?? ''),
      orgName: String(form.get('orgName') ?? '')
    };

    const state = await readOnboarding(db, user, event.cookies.get(ORG_COOKIE) ?? null);
    const outcome = await saveOnboarding(db, user, state, input);

    if (outcome !== OnboardingSave.Saved) {
      return fail(BAD_REQUEST, { error: outcome, ...input });
    }

    throw redirect(SEE_OTHER, next);
  }
};
