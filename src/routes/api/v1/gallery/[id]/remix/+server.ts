import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { agentActor } from '$lib/server/repos/actor';
import { MCP_AGENT_KEY } from '$lib/server/motion/ask';
import { remixInto } from '$lib/server/gallery/service';
import { REMIX_STATUS } from '$lib/server/gallery/http';
import type { RequestHandler } from './$types';

const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;

const bodySchema = z.object({ project_id: z.string().min(1), canvas_id: z.string().min(1).optional() });

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

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: 'invalid_body', detail: body.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
  }

  const remixed = await remixInto({ db, orgId, userId, actor: agentActor(userId, MCP_AGENT_KEY) }, { itemId: params.id ?? '', projectId: body.data.project_id, canvasId: body.data.canvas_id ?? null });
  if (!remixed.ok) {
    return json({ error: remixed.error, detail: remixed.message }, { status: REMIX_STATUS[remixed.error] });
  }
  return json({ node_id: remixed.start.nodeId, project_id: remixed.start.projectId, canvas_id: remixed.start.canvasId, editor_url: `${url.origin}${remixed.editorPath}`, title: remixed.title }, { status: HTTP_CREATED });
};
