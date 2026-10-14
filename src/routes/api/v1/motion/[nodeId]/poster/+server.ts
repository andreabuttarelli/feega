import { isActionFailure, json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { agentActor } from '$lib/server/repos/actor';
import { MCP_AGENT_KEY } from '$lib/server/motion/ask';
import { callerMotionScope } from '$lib/server/motion/editor-scope';
import { savePoster } from '$lib/server/motion/poster';
import type { RequestHandler } from './$types';

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

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

  const scope = await callerMotionScope(db, { orgId, userId, nodeId: params.nodeId ?? '' });
  if (!scope) {
    return json({ error: 'motion_node_not_found' }, { status: HTTP_NOT_FOUND });
  }

  const form = await request.formData();
  const saved = await savePoster(db, { orgId, projectId: scope.canvas.projectId, nodeId: scope.motion.record.id, actor: agentActor(userId, MCP_AGENT_KEY), form });
  return isActionFailure(saved) ? json(saved.data, { status: saved.status }) : json(saved);
};
