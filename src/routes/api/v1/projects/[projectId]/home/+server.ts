import type { RequestHandler } from './$types';
import { servePage, type PageHandler } from '$lib/server/api/bearer-page';
import { load } from '$lib/server/projects/home';

export const GET: RequestHandler = ({ request, url, params }) => servePage(request, url, `/p/${params.projectId}`, params, load as PageHandler);
