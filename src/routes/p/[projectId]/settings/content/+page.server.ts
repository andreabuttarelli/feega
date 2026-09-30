import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import type { Db } from '$lib/server/db/client';
import { settingsScope } from '$lib/server/settings-actions';
import {
  disableUncensored,
  enableUncensored,
  markAdultPersona,
  PersonaMark,
  uncensoredAccess,
  UNCENSORED_POLICY_VERSION,
  type OptInOutcome
} from '$lib/server/uncensored-access';

const CHECKED = 'on';
const AI_PERSONA_SOURCE = 'generated';

const OPT_IN_ERRORS: Readonly<Record<string, string>> = {
  owner_only: 'Only the workspace owner can change this.',
  confirmation_required: 'Confirm you are 18 or older and accept the uncensored mode policy.',
  plan_not_entitled: 'Uncensored models need a paid plan.',
  not_an_ai_persona: 'Only AI influencers created in this workspace can be marked.',
  not_an_adult: 'Only influencers declared 18 or older can be marked.'
};

async function scopeOf(event: RequestEvent | Parameters<PageServerLoad>[0]) {
  const { data: { user } } = await event.locals.supabase.auth.getUser();
  if (!user) {
    throw redirect(303, '/login');
  }
  const scope = await settingsScope(event.locals.supabase, event.params.projectId ?? '');
  if (!scope) {
    throw error(404, 'No organization');
  }
  return { db: event.locals.supabase as unknown as Db, orgId: scope.orgId, userId: user.id };
}

export const load: PageServerLoad = async (event) => {
  const { db, orgId } = await scopeOf(event);
  const { data: personas } = await event.locals.supabase
    .from('influencers')
    .select('id, name, age, adult_persona_at')
    .eq('org_id', orgId)
    .eq('source', AI_PERSONA_SOURCE)
    .is('deleted_at', null)
    .order('name');

  return {
    access: await uncensoredAccess(db, orgId),
    policyVersion: UNCENSORED_POLICY_VERSION,
    personas: (personas ?? []) as Array<{ id: string; name: string; age: number | null; adult_persona_at: string | null }>
  };
};

function answer(outcome: OptInOutcome) {
  return outcome.ok ? { saved: true } : fail(400, { error: OPT_IN_ERRORS[outcome.error] ?? outcome.error });
}

export const actions: Actions = {
  enable: async (event) => {
    const { db, orgId, userId } = await scopeOf(event);
    const fd = await event.request.formData();
    return answer(
      await enableUncensored(db, {
        orgId,
        userId,
        attestedAdult: fd.get('attestAdult') === CHECKED,
        acceptedPolicy: fd.get('acceptPolicy') === CHECKED
      })
    );
  },

  disable: async (event) => {
    const { db, orgId, userId } = await scopeOf(event);
    return answer(await disableUncensored(db, { orgId, userId }));
  },

  persona: async (event) => {
    const { db, orgId, userId } = await scopeOf(event);
    const fd = await event.request.formData();
    const mark = fd.get('mark') === PersonaMark.On ? PersonaMark.On : PersonaMark.Off;
    return answer(await markAdultPersona(db, { orgId, userId, influencerId: String(fd.get('influencerId') ?? ''), mark }));
  }
};
