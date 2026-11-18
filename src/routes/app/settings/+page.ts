import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { DASHBOARD_SETTINGS_HOME } from '$lib/settings/paths';

const SEE_OTHER = 303;

export const load: PageLoad = () => {
  throw redirect(SEE_OTHER, DASHBOARD_SETTINGS_HOME);
};
