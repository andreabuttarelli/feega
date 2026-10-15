import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { callerReach } from '$lib/server/org-data/reach';
import { videoFromTemplate } from '$lib/server/motion/from-template';
import type { RequestHandler } from './$types';

const HTTP_FORBIDDEN = 403;

export const POST: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  const { db, orgId, userId, writeAllowed } = resolved.caller;
  if (!writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }
  const body = (await request.json().catch(() => ({}))) as { project?: unknown };
  const unreachable = await callerReach(resolved.caller, { project: typeof body.project === 'string' ? body.project : null });
  if (unreachable) {
    return unreachable;
  }
  const out = await videoFromTemplate(db, { orgId, userId }, body);
  return out instanceof Response ? out : json(out);
};
