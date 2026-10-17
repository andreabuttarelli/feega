import type { RequestHandler } from './$types';
import { PATH_PARAM, answerOf, bearerOf } from '$lib/server/api/bearer-page';
import { settingsChain } from './chain';

export const GET: RequestHandler = async ({ request, url, params }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const pagePath = url.searchParams.get(PATH_PARAM) ?? `/p/${params.projectId}/settings`;
  const { layout } = settingsChain(bearer, request, url, pagePath, params.projectId);
  return answerOf(layout);
};
