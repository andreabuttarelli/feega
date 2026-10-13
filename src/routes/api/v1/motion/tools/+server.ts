import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { motionToolList, motionToolSpec } from '$lib/server/motion/tool-run';
import type { RequestHandler } from './$types';

const HTTP_NOT_FOUND = 404;

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  const name = url.searchParams.get('name');
  if (!name) {
    return json({ tools: motionToolList() });
  }
  const tool = await motionToolSpec(name);
  return tool ? json({ tool }) : json({ error: 'unknown_tool' }, { status: HTTP_NOT_FOUND });
};
