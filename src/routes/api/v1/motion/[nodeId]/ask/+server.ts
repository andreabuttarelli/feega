import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { gateOrgAiAction } from '$lib/server/cli-auth';
import { AGENT_MAX_DURATION_S } from '$lib/server/project-agent/limits';
import { askMotion } from '$lib/server/motion/ask';
import type { RequestHandler } from './$types';

export const config = { maxDuration: AGENT_MAX_DURATION_S };

const HTTP_ACCEPTED = 202;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;

const bodySchema = z.object({ prompt: z.string().trim().min(1).max(8000) });

export const POST: RequestHandler = async ({ request, params, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  const { db, orgId, userId, apiKeyId, writeAllowed } = resolved.caller;
  if (!writeAllowed) {
    return json({ error: 'api_key_read_only' }, { status: HTTP_FORBIDDEN });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: 'empty_prompt' }, { status: HTTP_BAD_REQUEST });
  }

  const gate = await gateOrgAiAction(orgId, apiKeyId ? { id: apiKeyId, name: '', user_id: userId, org_id: orgId, scopes: ['write'] } : undefined);
  if (gate) {
    return gate;
  }

  const asked = await askMotion(db, { orgId, userId, nodeId: params.nodeId ?? '', prompt: body.data.prompt });
  if (asked instanceof Response) {
    return asked;
  }
  return json({ run_id: asked.runId, status: 'running' }, { status: HTTP_ACCEPTED });
};
