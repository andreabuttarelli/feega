import type { RequestHandler } from './$types';
import { PATH_PARAM, answerOf, bearerOf } from '$lib/server/api/bearer-page';
import { DASHBOARD_SETTINGS_PATH } from '$lib/settings/paths';
import { dashboardChain } from './chain';

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const { page } = dashboardChain(bearer, request, url, url.searchParams.get(PATH_PARAM) ?? DASHBOARD_SETTINGS_PATH);
  return answerOf(() => (page as { parent: () => Promise<unknown> }).parent());
};
