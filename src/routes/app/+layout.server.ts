import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { DASHBOARD_PATH, isReachable } from '$lib/app-routes';

const SEE_OTHER = 303;

export const load: LayoutServerLoad = ({ url }) => {
  if (!isReachable(url.pathname)) {
    throw redirect(SEE_OTHER, DASHBOARD_PATH);
  }
};
