import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { BrandFromSite, brandFromSite } from '$lib/server/start/brand-from-site';
import { liveBrandPorts } from '$lib/server/start/live-brand-ports';
import { START_URL_MAX, startUrlOf } from '$lib/start-url';
import type { RequestHandler } from './$types';

const BAD_REQUEST = 400;
const BAD_GATEWAY = 502;

const askSchema = z.object({ canvasId: z.string().min(1), url: z.string().min(1).max(START_URL_MAX), x: z.number().finite(), y: z.number().finite() });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = askSchema.safeParse(await event.request.json().catch(() => null));
  const url = ask.success ? startUrlOf(ask.data.url) : null;
  if (!ask.success || !url) {
    return json({ error: 'invalid' }, { status: BAD_REQUEST });
  }

  const done = await brandFromSite({ orgId: scope.orgId, projectId: scope.projectId, canvasId: ask.data.canvasId }, url, { x: ask.data.x, y: ask.data.y }, liveBrandPorts(scope.db, { userId: scope.userId }));
  if (done.outcome === BrandFromSite.Failed) {
    return json({ error: done.error }, { status: BAD_GATEWAY });
  }
  return json(done);
};
