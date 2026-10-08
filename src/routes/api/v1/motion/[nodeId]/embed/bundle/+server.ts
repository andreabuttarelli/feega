import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { EmbedFailure, motionBundle } from '$lib/server/motion/agent-embed';
import type { RequestHandler } from './$types';

const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

const STATUS_OF: Partial<Record<EmbedFailure, number>> = { [EmbedFailure.NotFound]: HTTP_NOT_FOUND, [EmbedFailure.Empty]: HTTP_CONFLICT };

export const GET: RequestHandler = async ({ request, params, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  const bundle = await motionBundle(resolved.caller.db, { orgId: resolved.caller.orgId, nodeId: params.nodeId ?? '' });
  if (!bundle.ok) {
    return json({ error: bundle.failure }, { status: STATUS_OF[bundle.failure] ?? HTTP_NOT_FOUND });
  }
  return new Response(bundle.html, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-disposition': `attachment; filename="${bundle.filename}"` } });
};
