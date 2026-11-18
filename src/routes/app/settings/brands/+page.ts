import type { PageLoad } from './$types';
import { loadBrandsList } from '$lib/settings/api';
import type { load as sectionLoad } from '$lib/server/settings/brands';

export const load: PageLoad = ({ url, depends }) => loadBrandsList<Awaited<ReturnType<typeof sectionLoad>>>(url, depends);
