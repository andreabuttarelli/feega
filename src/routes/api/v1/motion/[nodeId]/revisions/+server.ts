import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { motionRevisions, restoreMotion } from '$lib/server/motion/ask';
import type { RequestHandler } from './$types';

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;

const bodySchema = z.object({ version: z.number().int().positive() });

async function callerOf(request: Request, url: URL) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
}

const answer = (out: Record<string, unknown> | Response) => (out instanceof Response ? out : json(out));

export const GET: RequestHandler = async ({ request, params, url }) => {
  const resolved = await callerOf(request, url);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  return answer(await motionRevisions(resolved.caller.db, { orgId: resolved.caller.orgId, nodeId: params.nodeId ?? '' }));
};

export const POST: RequestHandler = async ({ request, params, url }) => {
  const resolved = await callerOf(request, url);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  const { db, orgId, userId, writeAllowed } = resolved.caller;
  if (!writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: 'invalid_version' }, { status: HTTP_BAD_REQUEST });
  }
  return answer(await restoreMotion(db, { orgId, userId, nodeId: params.nodeId ?? '', version: body.data.version }));
};
