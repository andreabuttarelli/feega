import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reachableCaller } from '$lib/server/org-data/reach';
import { makeEffectsPair } from '$lib/server/canvas/effects-actions';
import { effectsResponse } from '$lib/server/canvas/effects-response';

export const POST: RequestHandler = async ({ request, params, url }) => {
  const caller = await reachableCaller(request, url, { nodes: [params.id ?? ''] });
  if (caller instanceof Response) {
    return caller;
  }

  const { db, orgId, userId, writeAllowed } = caller;
  if (!writeAllowed) return json({ error: 'api_key_read_only' }, { status: 403 });

  const out = await makeEffectsPair(db, { orgId, nodeId: params.id ?? '', actor: { kind: 'user', id: userId } });
  return effectsResponse(out);
};
