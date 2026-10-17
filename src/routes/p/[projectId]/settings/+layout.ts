import type { LayoutLoad } from './$types';
import { loadSettingsShell } from '$lib/settings/api';
import type { load as shellLoad } from '$lib/server/settings/shell';

export const ssr = false;

export const load: LayoutLoad = ({ params, url, depends }) =>
  loadSettingsShell<Awaited<ReturnType<typeof shellLoad>>>(params.projectId, url, depends);
