import { json } from '@sveltejs/kit';
import { reachableCaller } from '$lib/server/org-data/reach';
import { appOrigin } from '$lib/server/app-url';
import { embedStatus } from '$lib/server/motion/agent-embed';
import { sharePlay } from '$lib/server/motion/agent-play';
import type { RequestHandler } from './$types';

const HTTP_FORBIDDEN = 403;

export const POST: RequestHandler = async ({ request, params, url }) => {
  const nodeId = params.nodeId ?? '';
  const found = await reachableCaller(request, url, { nodes: [nodeId] });
  if (found instanceof Response) {
    return found;
  }
  if (!found.writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }

  const result = await sharePlay(found.db, { orgId: found.orgId, nodeId }, appOrigin(url));
  return json(result.body, { status: embedStatus(result) });
};
