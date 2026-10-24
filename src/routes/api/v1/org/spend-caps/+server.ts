import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callerOf } from '$lib/server/effects/http';
import { isOrgAdmin } from '$lib/server/model-allowlist/admin';
import { readCaps, removeCap, saveCap } from '$lib/server/spend-caps/store';
import { capInputSchema } from '$lib/server/spend-caps/input';

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_UNAVAILABLE = 503;

export const GET: RequestHandler = async ({ request, url }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }

  const caps = await readCaps(resolved.caller.db, resolved.caller.orgId);
  if (!caps) {
    return json({ error: 'unavailable' }, { status: HTTP_UNAVAILABLE });
  }
  return json({ caps: caps.map((cap) => ({ scope: cap.scope, project_id: cap.projectId, cap_usd: cap.capUsd, reset: cap.reset })) });
};

export const PUT: RequestHandler = async ({ request, url }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }

  const { db, orgId, userId } = resolved.caller;
  if (!(await isOrgAdmin(db, orgId, userId))) {
    return json({ error: 'forbidden' }, { status: HTTP_FORBIDDEN });
  }

  const body = capInputSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: 'invalid_body', detail: body.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
  }

  const { scope, project_id: projectId = null, cap_usd: capUsd, reset } = body.data;
  const done =
    capUsd === null
      ? await removeCap(db, { orgId, scope, projectId })
      : await saveCap(db, { orgId, cap: { scope, projectId, capUsd, reset } });

  return done ? json({ scope, project_id: projectId, cap_usd: capUsd, reset }) : json({ error: 'unavailable' }, { status: HTTP_UNAVAILABLE });
};
