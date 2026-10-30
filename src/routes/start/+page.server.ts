import { redirect } from '@sveltejs/kit';
import { START_URL_PARAM, startHost, startUrlOf } from '$lib/start-url';
import type { PageServerLoad } from './$types';

const SEE_OTHER = 303;
const HOME = '/app';

export const load: PageServerLoad = async ({ url, locals }) => {
  const startUrl = startUrlOf(url.searchParams.get(START_URL_PARAM));
  if (!startUrl) {
    throw redirect(SEE_OTHER, HOME);
  }

  const { user } = await locals.safeGetSession();
  if (!user) {
    throw redirect(SEE_OTHER, `/login?${START_URL_PARAM}=${encodeURIComponent(startUrl)}`);
  }
  return { url: startUrl, host: startHost(startUrl) };
};
