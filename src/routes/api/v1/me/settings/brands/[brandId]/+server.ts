import type { RequestHandler } from './$types';
import { PATH_PARAM, answerOf, bearerOf } from '$lib/server/api/bearer-page';
import { brandSettingsHref } from '$lib/components/settings/platforms';
import { brandChain } from '../chain';

export const GET: RequestHandler = async ({ request, url, params }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const pagePath = url.searchParams.get(PATH_PARAM) ?? brandSettingsHref(params.brandId, '');
  return answerOf(brandChain(bearer, request, url, pagePath, params.brandId).page.parent);
};
