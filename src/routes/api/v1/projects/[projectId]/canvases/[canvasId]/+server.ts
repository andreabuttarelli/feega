import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ACTION_PARAM, answerOf, bearerOf, pageEvent } from '$lib/server/api/bearer-page';
import { actions, load } from '$lib/server/canvas/canvas-page';

export { config } from '$lib/server/canvas/canvas-page';

const NOT_FOUND = 404;

type Handler = (event: never) => unknown;
type Params = { projectId: string; canvasId: string };

async function serve(request: Request, url: URL, params: Params, handler: Handler | undefined): Promise<Response> {
  if (!handler) {
    return json({ error: 'not_found' }, { status: NOT_FOUND });
  }

  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const event = pageEvent(bearer, request, url, `/p/${params.projectId}/c/${params.canvasId}`, params);
  return answerOf(async () => handler(event as never));
}

export const GET: RequestHandler = ({ request, url, params }) => serve(request, url, params, load as Handler);

export const POST: RequestHandler = ({ request, url, params }) =>
  serve(request, url, params, (actions as Record<string, Handler>)[url.searchParams.get(ACTION_PARAM) ?? '']);
