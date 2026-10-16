import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { reachableCaller } from '$lib/server/org-data/reach';
import { motionRevisions, restoreMotion } from '$lib/server/motion/ask';
import type { RequestHandler } from './$types';

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;

const bodySchema = z.object({ version: z.number().int().positive() });

function callerOf(request: Request, url: URL, nodeId: string | undefined) {
  return reachableCaller(request, url, { nodes: [nodeId ?? ''] });
}

const answer = (out: Record<string, unknown> | Response) => (out instanceof Response ? out : json(out));

export const GET: RequestHandler = async ({ request, params, url }) => {
  const caller = await callerOf(request, url, params.nodeId);
  if (caller instanceof Response) {
    return caller;
  }
  return answer(await motionRevisions(caller.db, { orgId: caller.orgId, nodeId: params.nodeId ?? '' }));
};

export const POST: RequestHandler = async ({ request, params, url }) => {
  const caller = await callerOf(request, url, params.nodeId);
  if (caller instanceof Response) {
    return caller;
  }

  const { db, orgId, userId, writeAllowed } = caller;
  if (!writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: 'invalid_version' }, { status: HTTP_BAD_REQUEST });
  }
  return answer(await restoreMotion(db, { orgId, userId, nodeId: params.nodeId ?? '', version: body.data.version }));
};
