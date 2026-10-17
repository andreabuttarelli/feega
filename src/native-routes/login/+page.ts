import { redirect } from '@sveltejs/kit';
import type { Load as PageLoad } from '@sveltejs/kit';
import { loginPageOf } from '$lib/login/login-page';
import { PAGE_PATH, DashboardPage } from '$lib/dashboard/pages';

const SEE_OTHER = 303;

export const load: PageLoad = async ({ url, parent }) => {
  const { session } = await parent();
  if (session) {
    redirect(SEE_OTHER, PAGE_PATH[DashboardPage.Home]);
  }
  return loginPageOf(url);
};
