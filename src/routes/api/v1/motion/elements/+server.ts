import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { callerReach } from '$lib/server/org-data/reach';
import { MOVE_STATUS, MoveOutcome, frameAnswer, frameRequest, frameRequestSchema, frameStore } from '$lib/server/motion/move-element';
import { agentActor } from '$lib/server/repos/actor';
import { TOOL_RUN_AGENT_KEY } from '$lib/server/motion/tool-run';
import type { RequestHandler } from './$types';

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
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

  const ask = frameRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!ask.success) {
    return json({ error: 'invalid_input', detail: ask.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
  }

  const unreachable = await callerReach(resolved.caller, { nodes: [ask.data.node_id, ask.data.frame_id, ask.data.to_frame_id].filter((id): id is string => Boolean(id)) });
  if (unreachable) {
    return unreachable;
  }

  const moved = await frameRequest(frameStore(db, { orgId, actor: agentActor(userId, TOOL_RUN_AGENT_KEY) }), ask.data);
  return json(frameAnswer(moved), { status: moved.outcome === MoveOutcome.Done ? HTTP_OK : MOVE_STATUS[moved.outcome] });
};
