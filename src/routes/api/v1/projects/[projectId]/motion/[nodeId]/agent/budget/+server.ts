import { json } from '@sveltejs/kit';
import { motionAgentScope } from '$lib/server/motion/agent-scope';
import { budgetCard, raiseVideoBudget } from '$lib/server/motion/video-budget';
import type { RequestHandler } from './$types';

const HTTP_NOT_FOUND = 404;

export const POST: RequestHandler = async ({ params, locals }) => {
  const scope = await motionAgentScope(locals, params);
  if (scope instanceof Response) {
    return scope;
  }
  const { db, user, orgId, motion } = scope;

  const raised = await raiseVideoBudget(db, { orgId, nodeId: motion.record.id, actor: { kind: 'user', id: user.id } });
  return raised ? json(budgetCard(raised)) : json({ error: 'node_not_found' }, { status: HTTP_NOT_FOUND });
};
