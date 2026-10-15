import type { PageLoad } from './$types';
import { loadPage } from '$lib/dashboard/api';
import { DashboardPage } from '$lib/dashboard/pages';
import type { HomeData } from '$lib/server/dashboard/pages/home';

export const load: PageLoad = ({ url, depends }) => loadPage<HomeData>(DashboardPage.Home, url, depends);
