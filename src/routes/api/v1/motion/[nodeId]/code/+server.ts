import { json } from '@sveltejs/kit';
import { DEFAULT_TARGET } from '@feega/motion-core/motion/codegen/index';
import { reachableCaller } from '$lib/server/org-data/reach';
import { frameCode } from '$lib/server/motion/code-export';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, url }) => {
  const nodeId = params.nodeId ?? '';
  const caller = await reachableCaller(request, url, { nodes: [nodeId] });
  if (caller instanceof Response) {
    return caller;
  }
  const out = await frameCode(caller.db, { orgId: caller.orgId, nodeId, target: url.searchParams.get('target') ?? DEFAULT_TARGET });
  return out instanceof Response ? out : json(out);
};
