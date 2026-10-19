import type { RequestHandler } from './$types';
import { actionOf, servePage, type PageHandler } from '$lib/server/api/bearer-page';
import { actions, load } from '$lib/server/motion/editor-page';

const pagePath = (params: { projectId: string; canvasId: string; nodeId: string }) => `/p/${params.projectId}/c/${params.canvasId}/motion/${params.nodeId}`;

export const GET: RequestHandler = ({ request, url, params }) => servePage(request, url, pagePath(params), params, load as PageHandler);

export const POST: RequestHandler = ({ request, url, params }) => servePage(request, url, pagePath(params), params, actionOf(actions, url));
