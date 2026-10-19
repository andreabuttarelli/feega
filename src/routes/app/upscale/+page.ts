import type { PageLoad } from './$types';
import { loadPage } from '$lib/dashboard/api';
import { DashboardPage } from '$lib/dashboard/pages';
import type { UpscaleData } from '$lib/server/dashboard/pages/upscale';

export const load: PageLoad = ({ url, depends }) => loadPage<UpscaleData>(DashboardPage.Upscale, url, depends);
