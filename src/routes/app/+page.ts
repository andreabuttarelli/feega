import type { PageLoad } from './$types';
import { loadBootstrap, loadPage } from '$lib/dashboard/api';
import { DashboardPage } from '$lib/dashboard/pages';
import type { HomeData } from '$lib/server/dashboard/pages/home';

export const load: PageLoad = async ({ url, depends }) => {
  const [{ dashboard }, page] = await Promise.all([loadBootstrap(depends), loadPage<HomeData>(DashboardPage.Home, url, depends)]);
  return { ...page, dashboard };
};
