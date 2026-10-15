import { json } from '@sveltejs/kit';
import { reachableCaller } from '$lib/server/org-data/reach';
import { editBoard, readBoard, writeBoard } from '$lib/server/motion/storyboard-api';
import type { RequestHandler } from './$types';

const HTTP_FORBIDDEN = 403;

function callerOf(request: Request, url: URL, nodeId: string | undefined) {
  return reachableCaller(request, url, { nodes: [nodeId ?? ''] });
}

const answer = (out: Record<string, unknown> | Response) => (out instanceof Response ? out : json(out));

type Write = typeof writeBoard;

function writing(run: Write): RequestHandler {
  return async ({ request, params, url }) => {
    const caller = await callerOf(request, url, params.nodeId);
    if (caller instanceof Response) {
      return caller;
    }
    const { db, orgId, userId, writeAllowed } = caller;
    if (!writeAllowed) {
      return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
    }
    return answer(await run(db, { orgId, userId, nodeId: params.nodeId ?? '' }, await request.json().catch(() => ({}))));
  };
}

export const GET: RequestHandler = async ({ request, params, url }) => {
  const caller = await callerOf(request, url, params.nodeId);
  if (caller instanceof Response) {
    return caller;
  }
  const { db, orgId, userId } = caller;
  return answer(await readBoard(db, { orgId, userId, nodeId: params.nodeId ?? '' }));
};

export const POST = writing(writeBoard);

export const PATCH = writing(editBoard);
