import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
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
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) return json(resolved.error.body, { status: resolved.error.status });

  const { db, orgId, userId, writeAllowed } = resolved.caller;
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
