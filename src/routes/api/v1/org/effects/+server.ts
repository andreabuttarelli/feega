import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { effectsCatalogue } from '$lib/canvas/effects/catalogue';

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) return json(resolved.error.body, { status: resolved.error.status });

  return json({ effects: effectsCatalogue() });
};
