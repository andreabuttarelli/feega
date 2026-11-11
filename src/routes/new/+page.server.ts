import { redirect } from '@sveltejs/kit';
import { DASHBOARD_PATH } from '$lib/server/tenancy/entry';
import type { PageServerLoad } from './$types';

const HTTP_SEE_OTHER = 303;

export const load: PageServerLoad = async ({ locals }) => {
  const { user } = await locals.safeGetSession();
  if (user) {
    throw redirect(HTTP_SEE_OTHER, DASHBOARD_PATH);
  }
  return {};
};
