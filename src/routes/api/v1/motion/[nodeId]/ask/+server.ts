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

const sourceSchema = z.union([
  z.object({ asset_id: z.string().min(1) }),
  z.object({ url: z.string().url(), name: z.string().max(200).optional() }),
  z.object({ data: z.string().min(1), name: z.string().min(1).max(200), mime_type: z.string().max(200) })
]);

const pickSchema = z.object({ follow: z.array(z.string().min(1)).max(12), avoid: z.array(z.string().min(1)).max(12), note: z.string().max(1000).optional(), rejected: z.boolean().optional(), query: z.string().max(300).optional(), avoid_all: z.boolean().optional() });

const bodySchema = z
  .object({ prompt: z.string().trim().max(8000).default(''), attachments: z.array(sourceSchema).optional(), reference_pick: pickSchema.optional() })
  .refine((b) => b.prompt.length > 0 || b.reference_pick, { path: ['prompt'] });

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
    return json({ error: body.error.issues.some((i) => i.path[0] === 'attachments') ? 'invalid_attachments' : 'empty_prompt' }, { status: HTTP_BAD_REQUEST });
  }

  const gate = await gateOrgAiAction(orgId, apiKeyId ? { id: apiKeyId, name: '', user_id: userId, org_id: orgId, scopes: ['write'] } : undefined);
  if (gate) {
    return gate;
  }

  const asked = await askMotion(db, { orgId, userId, nodeId: params.nodeId ?? '', prompt: body.data.prompt, attachments: body.data.attachments, pick: body.data.reference_pick });
  if (asked instanceof Response) {
    return asked;
  }
  return json({ run_id: asked.runId, status: 'running' }, { status: HTTP_ACCEPTED });
};
