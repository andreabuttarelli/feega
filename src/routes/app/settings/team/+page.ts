import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { TEAM_PATH } from '$lib/settings/paths';

const SEE_OTHER = 303;

export const load: PageLoad = () => {
  throw redirect(SEE_OTHER, TEAM_PATH);
};
