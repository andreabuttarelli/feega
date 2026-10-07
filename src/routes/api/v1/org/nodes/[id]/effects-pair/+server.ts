import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { makeEffectsPair } from '$lib/server/canvas/effects-actions';
import { effectsResponse } from '$lib/server/canvas/effects-response';

export const POST: RequestHandler = async ({ request, params, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) return json(resolved.error.body, { status: resolved.error.status });

  const { db, orgId, userId, writeAllowed } = resolved.caller;
  if (!writeAllowed) return json({ error: 'api_key_read_only' }, { status: 403 });

  const out = await makeEffectsPair(db, { orgId, nodeId: params.id ?? '', actor: { kind: 'user', id: userId } });
  return effectsResponse(out);
};
