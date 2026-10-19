import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { actionOf, servePage, type PageHandler } from '$lib/server/api/bearer-page';
import { PROJECT_PAGE_PATH, ProjectPage, isProjectPage } from '$lib/project-pages';

const NOT_FOUND = 404;

type PageModule = { load: PageHandler; actions: object };

const MODULES: Record<ProjectPage, () => Promise<PageModule>> = {
  [ProjectPage.Assets]: () => import('$lib/server/project-pages/assets') as Promise<PageModule>,
  [ProjectPage.Influencers]: () => import('$lib/server/project-pages/influencers') as Promise<PageModule>,
  [ProjectPage.BrandNew]: () => import('$lib/server/project-pages/brand-new') as Promise<PageModule>
};

type Params = { projectId: string; page: string };

async function serve(request: Request, url: URL, params: Params, pick: (module: PageModule) => PageHandler | undefined): Promise<Response> {
  if (!isProjectPage(params.page)) {
    return json({ error: 'not_found' }, { status: NOT_FOUND });
  }

  const handler = pick(await MODULES[params.page]());
  const pagePath = `/p/${params.projectId}/${PROJECT_PAGE_PATH[params.page]}`;
  return servePage(request, url, pagePath, { projectId: params.projectId }, handler);
}

export const GET: RequestHandler = ({ request, url, params }) => serve(request, url, params, (module) => module.load);

export const POST: RequestHandler = ({ request, url, params }) => serve(request, url, params, (module) => actionOf(module.actions, url));
