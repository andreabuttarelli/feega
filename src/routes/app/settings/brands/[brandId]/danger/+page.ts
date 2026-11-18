import type { PageLoad } from './$types';
import { loadBrandPage } from '$lib/settings/api';
import { SettingsSection } from '$lib/settings/sections';
import type { load as sectionLoad } from '$lib/server/settings/pages/danger';

export const load: PageLoad = ({ params, url, depends }) =>
  loadBrandPage<Awaited<ReturnType<typeof sectionLoad>>>(params.brandId, SettingsSection.Danger, url, depends);
