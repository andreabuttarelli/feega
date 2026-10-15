import { json } from '@sveltejs/kit';
import { reachableCaller } from '$lib/server/org-data/reach';
import { appOrigin } from '$lib/server/app-url';
import { EmbedFailure, motionEmbedState, publishMotionEmbed, unpublishMotionEmbed, type EmbedAnswer } from '$lib/server/motion/agent-embed';
import type { RequestHandler } from './$types';

const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_BAD_GATEWAY = 502;

const STATUS_OF: Record<EmbedFailure, number> = {
  [EmbedFailure.NotFound]: HTTP_NOT_FOUND,
  [EmbedFailure.Empty]: HTTP_CONFLICT,
  [EmbedFailure.Refused]: HTTP_FORBIDDEN,
  [EmbedFailure.Storage]: HTTP_BAD_GATEWAY
};

const answer = (result: EmbedAnswer) => json(result.body, { status: result.ok ? HTTP_OK : STATUS_OF[result.failure] });

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
  return answer(await motionEmbedState(found.db, { orgId: found.orgId, nodeId: params.nodeId ?? '' }, appOrigin(url)));
};

export const POST: RequestHandler = async ({ request, params, url }) => {
  const found = await caller(request, url, Access.Write, params.nodeId);
  if (found instanceof Response) {
    return found;
  }
  return answer(await publishMotionEmbed(found.db, { orgId: found.orgId, nodeId: params.nodeId ?? '' }, appOrigin(url)));
};

export const DELETE: RequestHandler = async ({ request, params, url }) => {
  const found = await caller(request, url, Access.Write, params.nodeId);
  if (found instanceof Response) {
    return found;
  }
  return answer(await unpublishMotionEmbed(found.db, { orgId: found.orgId, nodeId: params.nodeId ?? '' }));
};
