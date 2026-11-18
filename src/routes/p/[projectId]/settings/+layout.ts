import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { loadSettingsShell } from '$lib/settings/api';
import { canvasRedirectOf } from '$lib/components/settings/platforms';
import type { load as shellLoad } from '$lib/server/settings/shell';

const TEMPORARY_REDIRECT = 307;

export const ssr = false;

export const load: LayoutLoad = ({ params, url, depends }) => {
  const moved = canvasRedirectOf(url.pathname);
  if (moved) {
    throw redirect(TEMPORARY_REDIRECT, `${moved}${url.search}${url.hash}`);
  }
  return loadSettingsShell<Awaited<ReturnType<typeof shellLoad>>>(params.projectId, url, depends);
};
