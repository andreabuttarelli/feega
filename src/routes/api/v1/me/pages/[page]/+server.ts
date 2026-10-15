import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ACTION_PARAM, answerOf, bearerOf, pageEvent } from '$lib/server/api/bearer-page';

const NOT_FOUND = 404;

type Handler = (event: never) => unknown;
type PageModule = { load?: Handler; actions?: Record<string, Handler> };
type DashboardPage = { path: string; module: () => Promise<PageModule> };

const PAGES: Record<string, DashboardPage> = {
  home: { path: '/app', module: () => import('../../../../../app/+page.server') },
  canvases: { path: '/app/canvases', module: () => import('../../../../../app/canvases/+page.server') },
  templates: { path: '/app/templates', module: () => import('../../../../../app/templates/+page.server') },
  motion: { path: '/app/motion', module: () => import('../../../../../app/motion/+page.server') },
  credits: { path: '/app/credits', module: () => import('../../../../../app/credits/+page.server') }
};

const UNKNOWN = () => json({ error: 'not_found' }, { status: NOT_FOUND });

async function serve(request: Request, url: URL, pageName: string, pick: (module: PageModule) => Handler | undefined): Promise<Response> {
  const page = PAGES[pageName];
  if (!page) {
    return UNKNOWN();
  }

  const handler = pick(await page.module());
  if (!handler) {
    return UNKNOWN();
  }

  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const event = pageEvent(bearer, request, url, page.path);
  return answerOf(async () => handler(event as never));
}

export const GET: RequestHandler = ({ request, url, params }) => serve(request, url, params.page, (module) => module.load);

export const POST: RequestHandler = ({ request, url, params }) => serve(request, url, params.page, (module) => module.actions?.[url.searchParams.get(ACTION_PARAM) ?? '']);
