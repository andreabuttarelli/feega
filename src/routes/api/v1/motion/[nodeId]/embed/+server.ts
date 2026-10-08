import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
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

async function caller(request: Request, url: URL, access: Access) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  if (access === Access.Write && !resolved.caller.writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }
  return resolved.caller;
}

export const GET: RequestHandler = async ({ request, params, url }) => {
  const found = await caller(request, url, Access.Read);
  if (found instanceof Response) {
    return found;
  }
  return answer(await motionEmbedState(found.db, { orgId: found.orgId, nodeId: params.nodeId ?? '' }, appOrigin(url)));
};

export const POST: RequestHandler = async ({ request, params, url }) => {
  const found = await caller(request, url, Access.Write);
  if (found instanceof Response) {
    return found;
  }
  return answer(await publishMotionEmbed(found.db, { orgId: found.orgId, nodeId: params.nodeId ?? '' }, appOrigin(url)));
};

export const DELETE: RequestHandler = async ({ request, params, url }) => {
  const found = await caller(request, url, Access.Write);
  if (found instanceof Response) {
    return found;
  }
  return answer(await unpublishMotionEmbed(found.db, { orgId: found.orgId, nodeId: params.nodeId ?? '' }));
};
