import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { writeSound } from '$lib/server/motion/sound';
import type { RequestHandler } from './$types';

const HTTP_FORBIDDEN = 403;

export const POST: RequestHandler = async ({ request, params, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  const { db, orgId, userId, writeAllowed } = resolved.caller;
  if (!writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }
  const out = await writeSound(db, { orgId, userId, nodeId: params.nodeId ?? '' }, await request.json().catch(() => ({})));
  return out instanceof Response ? out : json(out);
};
