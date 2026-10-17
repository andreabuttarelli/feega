import { json } from '@sveltejs/kit';
import { reachableCaller } from '$lib/server/org-data/reach';
import { addTemplate } from '$lib/server/motion/template-api';
import type { RequestHandler } from './$types';

const HTTP_FORBIDDEN = 403;

export const POST: RequestHandler = async ({ request, params, url }) => {
  const caller = await reachableCaller(request, url, { nodes: [params.nodeId ?? ''] });
  if (caller instanceof Response) {
    return caller;
  }
  const { db, orgId, userId, writeAllowed } = caller;
  if (!writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }
  const out = await addTemplate(db, { orgId, userId, nodeId: params.nodeId ?? '' }, await request.json().catch(() => ({})));
  return out instanceof Response ? out : json(out);
};
