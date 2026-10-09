import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { editBoard, readBoard, writeBoard } from '$lib/server/motion/storyboard-api';
import type { RequestHandler } from './$types';

const HTTP_FORBIDDEN = 403;

async function callerOf(request: Request, url: URL) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
}

const answer = (out: Record<string, unknown> | Response) => (out instanceof Response ? out : json(out));

type Write = typeof writeBoard;

function writing(run: Write): RequestHandler {
  return async ({ request, params, url }) => {
    const resolved = await callerOf(request, url);
    if ('error' in resolved) {
      return json(resolved.error.body, { status: resolved.error.status });
    }
    const { db, orgId, userId, writeAllowed } = resolved.caller;
    if (!writeAllowed) {
      return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
    }
    return answer(await run(db, { orgId, userId, nodeId: params.nodeId ?? '' }, await request.json().catch(() => ({}))));
  };
}

export const GET: RequestHandler = async ({ request, params, url }) => {
  const resolved = await callerOf(request, url);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  const { db, orgId, userId } = resolved.caller;
  return answer(await readBoard(db, { orgId, userId, nodeId: params.nodeId ?? '' }));
};

export const POST = writing(writeBoard);

export const PATCH = writing(editBoard);
