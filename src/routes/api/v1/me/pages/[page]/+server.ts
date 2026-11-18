import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DashboardPage, PAGE_PATH, isDashboardPage } from '$lib/dashboard/pages';
import { ACTION_PARAM, answerOf, bearerOf, pageEvent } from '$lib/server/api/bearer-page';

const NOT_FOUND = 404;

type Handler = (event: never) => unknown;
type PageModule = { load?: Handler; actions?: Record<string, Handler> };

const MODULES: Record<DashboardPage, () => Promise<PageModule>> = {
  [DashboardPage.Home]: () => import('$lib/server/dashboard/pages/home'),
  [DashboardPage.Canvases]: () => import('$lib/server/dashboard/pages/canvases'),
  [DashboardPage.Templates]: () => import('$lib/server/dashboard/pages/templates'),
  [DashboardPage.Motion]: () => import('$lib/server/dashboard/pages/motion'),
  [DashboardPage.Credits]: () => import('$lib/server/dashboard/pages/credits'),
  [DashboardPage.Compose]: () => import('$lib/server/dashboard/pages/compose'),
  [DashboardPage.Upscale]: () => import('$lib/server/dashboard/pages/upscale')
};

const UNKNOWN = () => json({ error: 'not_found' }, { status: NOT_FOUND });

async function serve(request: Request, url: URL, pageName: string, pick: (module: PageModule) => Handler | undefined): Promise<Response> {
  if (!isDashboardPage(pageName)) {
    return UNKNOWN();
  }

  const handler = pick(await MODULES[pageName]());
  if (!handler) {
    return UNKNOWN();
  }

  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const event = pageEvent(bearer, request, url, PAGE_PATH[pageName]);
  return answerOf(async () => handler(event as never));
}

export const GET: RequestHandler = ({ request, url, params }) => serve(request, url, params.page, (module) => module.load);

export const POST: RequestHandler = ({ request, url, params }) => serve(request, url, params.page, (module) => module.actions?.[url.searchParams.get(ACTION_PARAM) ?? '']);
