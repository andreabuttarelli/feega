import type { PageLoad } from './$types';
import { loadSettingsPage } from '$lib/settings/api';
import { SettingsSection } from '$lib/settings/sections';
import type { load as sectionLoad } from '$lib/server/settings/pages/models';

export const load: PageLoad = ({ params, url, depends }) =>
  loadSettingsPage<Awaited<ReturnType<typeof sectionLoad>>>(params.projectId, SettingsSection.Models, url, depends);
