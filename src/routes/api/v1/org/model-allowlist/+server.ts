import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { callerOf } from '$lib/server/effects/http';
import { isOrgAdmin, readAllowlist, setAllowlist, ALLOWLIST_MEDIA_LIST } from '$lib/server/model-allowlist/admin';

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_UNAVAILABLE = 503;

const bodySchema = z.object({ medium: z.enum(ALLOWLIST_MEDIA_LIST), model_ids: z.array(z.string().min(1)).max(500) });

export const GET: RequestHandler = async ({ request, url }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }

  const lists = await readAllowlist(resolved.caller.db, resolved.caller.orgId);
  return lists ? json(lists) : json({ error: 'unavailable' }, { status: HTTP_UNAVAILABLE });
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

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: 'invalid_body', detail: body.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
  }

  const saved = await setAllowlist(db, { orgId, medium: body.data.medium, modelIds: body.data.model_ids });
  return saved ? json({ medium: body.data.medium, model_ids: [...new Set(body.data.model_ids)] }) : json({ error: 'unavailable' }, { status: HTTP_UNAVAILABLE });
};
