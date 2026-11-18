import type { PageLoad } from './$types';
import { loadDashboardPage } from '$lib/settings/api';
import { SettingsSection } from '$lib/settings/sections';
import type { load as sectionLoad } from '$lib/server/settings/pages/profile';

export const load: PageLoad = ({ url, depends }) => loadDashboardPage<Awaited<ReturnType<typeof sectionLoad>>>(SettingsSection.Profile, url, depends);
