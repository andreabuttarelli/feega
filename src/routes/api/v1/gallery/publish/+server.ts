import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { agentActor } from '$lib/server/repos/actor';
import { MCP_AGENT_KEY } from '$lib/server/motion/ask';
import { publishNode } from '$lib/server/gallery/service';
import { publishStatus } from '$lib/server/gallery/http';
import { itemPath } from '$lib/gallery/model';
import type { RequestHandler } from './$types';

const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;

const bodySchema = z.object({ node_id: z.string().min(1), title: z.string(), description: z.string().optional(), tags: z.array(z.string()).optional() });

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

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: 'invalid_body', detail: body.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
  }

  const { node_id, ...meta } = body.data;
  const published = await publishNode({ db, orgId, userId, actor: agentActor(userId, MCP_AGENT_KEY) }, { nodeId: node_id, meta });
  if (!published.ok) {
    return json({ error: published.error, detail: published.message }, { status: publishStatus(published.error) });
  }
  return json({ id: published.id, url: `${url.origin}${itemPath(published.id)}` }, { status: HTTP_CREATED });
};
