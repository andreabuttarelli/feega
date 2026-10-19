import type { RequestHandler } from './$types';
import { actionOf, servePage, type PageHandler } from '$lib/server/api/bearer-page';
import { actions, load } from '$lib/server/studio/batch-page';

export { config } from '$lib/server/studio/batch-page';

const pagePath = (params: { batchId: string }) => `/app/studio/${params.batchId}`;

export const GET: RequestHandler = ({ request, url, params }) => servePage(request, url, pagePath(params), params, load as PageHandler);

export const POST: RequestHandler = ({ request, url, params }) => servePage(request, url, pagePath(params), params, actionOf(actions, url));
