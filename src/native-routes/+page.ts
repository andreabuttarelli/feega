import { redirect } from '@sveltejs/kit';
import type { Load as PageLoad } from '@sveltejs/kit';
import { PAGE_PATH, DashboardPage } from '$lib/dashboard/pages';

const SEE_OTHER = 303;

export const load: PageLoad = () => {
  redirect(SEE_OTHER, PAGE_PATH[DashboardPage.Home]);
};
