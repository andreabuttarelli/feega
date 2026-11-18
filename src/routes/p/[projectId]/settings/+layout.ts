import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { loadSettingsShell } from '$lib/settings/api';
import { brandRedirectOf, canvasRedirectOf } from '$lib/components/settings/platforms';
import type { load as shellLoad } from '$lib/server/settings/shell';

const TEMPORARY_REDIRECT = 307;

export const ssr = false;

export const load: LayoutLoad = async ({ params, url, depends }) => {
  const moved = canvasRedirectOf(url.pathname);
  if (moved) {
    throw redirect(TEMPORARY_REDIRECT, `${moved}${url.search}`);
  }

  const shell = await loadSettingsShell<Awaited<ReturnType<typeof shellLoad>>>(params.projectId, url, depends);
  const brandMoved = brandRedirectOf(url.pathname, shell.brand?.id ?? null);
  if (brandMoved) {
    throw redirect(TEMPORARY_REDIRECT, `${brandMoved}${url.search}`);
  }
  return shell;
};
