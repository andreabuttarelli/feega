import type { PageLoad } from './$types';
import { loadPage } from '$lib/dashboard/api';
import { DashboardPage } from '$lib/dashboard/pages';
import type { StudioData } from '$lib/server/dashboard/pages/studio';

export const load: PageLoad = ({ url, depends }) => loadPage<StudioData>(DashboardPage.Studio, url, depends);
