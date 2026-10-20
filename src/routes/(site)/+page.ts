import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { bundleApiBase } from '$lib/api/bundle-fetch';
import { BUNDLE_HOME } from '$lib/auth/bundle-auth';

const TEMPORARY_REDIRECT = 307;

export const load = () => {
  if (browser && bundleApiBase()) {
    redirect(TEMPORARY_REDIRECT, BUNDLE_HOME);
  }
};
