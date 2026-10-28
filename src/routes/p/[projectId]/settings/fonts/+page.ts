import type { PageLoad } from './$types';
import { loadSettingsPage } from '$lib/settings/api';
import { SettingsSection } from '$lib/settings/sections';
import type { load as sectionLoad } from '$lib/server/settings/pages/fonts';

export const load: PageLoad = ({ params, url, depends }) =>
  loadSettingsPage<Awaited<ReturnType<typeof sectionLoad>>>(params.projectId, SettingsSection.Fonts, url, depends);
