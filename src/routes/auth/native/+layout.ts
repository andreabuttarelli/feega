import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { bundleApiBase } from '$lib/api/bundle-fetch';

export const ssr = false;

const WEB_LOGIN = '/login';
const SEE_OTHER = 303;

export const load: LayoutLoad = () => {
  if (!bundleApiBase()) {
    redirect(SEE_OTHER, WEB_LOGIN);
  }
};
