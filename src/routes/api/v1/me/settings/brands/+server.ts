import type { RequestHandler } from './$types';
import { ACTION_PARAM, PATH_PARAM, answerOf, bearerOf } from '$lib/server/api/bearer-page';
import { BRANDS_SETTINGS_PATH } from '$lib/settings/paths';
import { actions, load } from '$lib/server/settings/brands';
import { dashboardChain } from '../chain';

const NOT_FOUND = 404;

async function serve(request: Request, url: URL, handler: ((event: never) => unknown) | undefined): Promise<Response> {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }
  if (!handler) {
    return Response.json({ error: 'not_found' }, { status: NOT_FOUND });
  }

  const { page } = dashboardChain(bearer, request, url, url.searchParams.get(PATH_PARAM) ?? BRANDS_SETTINGS_PATH);
  return answerOf(async () => handler(page as never));
}

export const GET: RequestHandler = ({ request, url }) => serve(request, url, load);

export const POST: RequestHandler = ({ request, url }) => serve(request, url, actions[url.searchParams.get(ACTION_PARAM) ?? '']);
