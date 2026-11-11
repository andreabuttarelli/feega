import { redirect } from '@sveltejs/kit';
import { DASHBOARD_PATH } from '$lib/server/tenancy/entry';
import { HANDOFF_PROMPT } from '$lib/home/handoff';
import type { PageServerLoad } from './$types';

const HTTP_SEE_OTHER = 303;

export const load: PageServerLoad = async ({ url, locals }) => {
  const { user } = await locals.safeGetSession();
  if (user && !url.searchParams.has(HANDOFF_PROMPT)) {
    throw redirect(HTTP_SEE_OTHER, DASHBOARD_PATH);
  }
  return {};
};
