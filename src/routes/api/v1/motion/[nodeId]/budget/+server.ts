import { json } from '@sveltejs/kit';
import { kindOf } from '$lib/motion/replica';
import { reachableCaller } from '$lib/server/org-data/reach';
import { budgetCard, raiseVideoBudget, readVideoBudget } from '$lib/server/motion/video-budget';
import { findNode } from '$lib/server/repos/canvas';
import { motionOf } from '$lib/canvas/motion-node';
import type { RequestHandler } from './$types';

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

const notFound = () => json({ error: 'motion_node_not_found' }, { status: HTTP_NOT_FOUND });

enum Access {
  Read = 'read',
  Write = 'write'
}

async function caller(request: Request, url: URL, access: Access, nodeId: string | undefined) {
  const found = await reachableCaller(request, url, { nodes: [nodeId ?? ''] });
  if (found instanceof Response) {
    return found;
  }
  if (access === Access.Write && !found.writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }
  return found;
}

export const GET: RequestHandler = async ({ request, params, url }) => {
  const found = await caller(request, url, Access.Read, params.nodeId);
  if (found instanceof Response) {
    return found;
  }
  const scope = { orgId: found.orgId, nodeId: params.nodeId ?? '' };
  const record = await findNode(found.db, scope);
  const motion = record ? motionOf(record) : null;
  if (!motion) {
    return notFound();
  }
  return json(budgetCard(await readVideoBudget(found.db, scope, motion.budgetRaisedUsd ?? 0, kindOf(motion.replicaOf))));
};

export const POST: RequestHandler = async ({ request, params, url }) => {
  const found = await caller(request, url, Access.Write, params.nodeId);
  if (found instanceof Response) {
    return found;
  }
  const raised = await raiseVideoBudget(found.db, { orgId: found.orgId, nodeId: params.nodeId ?? '', actor: { kind: 'user', id: found.userId } });
  return raised ? json(budgetCard(raised)) : notFound();
};
