import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reachableCaller } from '$lib/server/org-data/reach';
import { applyEffectsTo } from '$lib/server/canvas/effects-actions';
import { effectsResponse } from '$lib/server/canvas/effects-response';

async function effectsOf(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) {
    return undefined;
  }
  return (JSON.parse(text) as { effects?: unknown }).effects;
}

export const POST: RequestHandler = async ({ request, params, url }) => {
  const caller = await reachableCaller(request, url, { nodes: [params.id ?? ''] });
  if (caller instanceof Response) {
    return caller;
  }

  const { db, orgId, userId, writeAllowed } = caller;
  if (!writeAllowed) return json({ error: 'api_key_read_only' }, { status: 403 });

  let effects: unknown;
  try {
    effects = await effectsOf(request);
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 });
  }

  const out = await applyEffectsTo(db, { orgId, nodeId: params.id ?? '', effects, actor: { kind: 'user', id: userId } });
  return effectsResponse(out);
};
