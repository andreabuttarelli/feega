import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { gateOrgAiAction } from '$lib/server/cli-auth';
import { agentActor } from '$lib/server/repos/actor';
import { MCP_AGENT_KEY } from '$lib/server/motion/ask';
import { callerMotionScope } from '$lib/server/motion/editor-scope';
import { EDITOR_OPS, EditorAccess, isEditorOp, runEditorOp, type EditorAnswer } from '$lib/server/frame-editor/editor-ops';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 60, memory: 2048 };

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

export const POST: RequestHandler = async ({ request, params, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  const { db, orgId, userId, apiKeyId, writeAllowed } = resolved.caller;

  const body = (await request.json().catch(() => ({}))) as { op?: string; input?: unknown };
  const name = body.op ?? '';
  if (!isEditorOp(name)) {
    return json({ error: 'unknown_op', ops: Object.keys(EDITOR_OPS) }, { status: HTTP_BAD_REQUEST });
  }

  const input = EDITOR_OPS[name].input.safeParse(body.input ?? {});
  if (!input.success) {
    return json({ error: 'invalid_input', issues: input.error.issues }, { status: HTTP_BAD_REQUEST });
  }
  if (EDITOR_OPS[name].access === EditorAccess.Write && !writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }

  const scope = await callerMotionScope(db, { orgId, userId, nodeId: params.nodeId ?? '' });
  if (!scope) {
    return json({ error: 'motion_node_not_found' }, { status: HTTP_NOT_FOUND });
  }

  const key = apiKeyId ? { id: apiKeyId, name: '', user_id: userId, org_id: orgId, scopes: ['write'] } : undefined;
  const gate = async (): Promise<EditorAnswer | null> => {
    const denied = await gateOrgAiAction(orgId, key);
    return denied ? { status: denied.status, body: await denied.json() } : null;
  };

  const answer = await runEditorOp(name, { ...scope, actor: agentActor(userId, MCP_AGENT_KEY), gate }, input.data as never);
  return json(answer.body, { status: answer.status });
};
