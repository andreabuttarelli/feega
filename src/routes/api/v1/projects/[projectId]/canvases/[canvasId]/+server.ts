import type { RequestHandler } from './$types';
import { actionOf, servePage, type PageHandler } from '$lib/server/api/bearer-page';
import { actions, load } from '$lib/server/canvas/canvas-page';

export { config } from '$lib/server/canvas/canvas-page';

const pagePath = (params: { projectId: string; canvasId: string }) => `/p/${params.projectId}/c/${params.canvasId}`;

export const GET: RequestHandler = ({ request, url, params }) => servePage(request, url, pagePath(params), params, load as PageHandler);

export const POST: RequestHandler = ({ request, url, params }) => servePage(request, url, pagePath(params), params, actionOf(actions, url));
