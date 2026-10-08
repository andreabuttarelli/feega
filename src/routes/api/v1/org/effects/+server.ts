import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { effectsCatalogue } from '$lib/canvas/effects/catalogue';
import { listEffects } from '$lib/server/repos/effects';
import { effectListing } from '$lib/server/effects/listing';

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) return json(resolved.error.body, { status: resolved.error.status });

  const custom = (await listEffects(resolved.caller.db, resolved.caller.orgId)) ?? [];
  return json({ effects: effectsCatalogue(), custom: custom.map(effectListing) });
};
