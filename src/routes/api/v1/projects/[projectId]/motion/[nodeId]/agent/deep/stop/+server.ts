import { json } from '@sveltejs/kit';
import { motionAgentScope } from '$lib/server/motion/agent-scope';
import { latestDeep, requestStop } from '$lib/server/repos/deep-runs';
import type { RequestHandler } from './$types';

const HTTP_NOT_FOUND = 404;

export const POST: RequestHandler = async ({ params, locals }) => {
  const scope = await motionAgentScope(locals, params);
  if (scope instanceof Response) {
    return scope;
  }
  const run = await latestDeep(scope.db, { orgId: scope.orgId, nodeId: scope.motion.record.id });
  const stopped = run ? await requestStop(scope.db, { orgId: scope.orgId, runId: run.id }) : false;
  return stopped ? json({ ok: true }) : json({ error: 'no_running_job' }, { status: HTTP_NOT_FOUND });
};
