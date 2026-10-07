import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { gateOrgAiAction } from '$lib/server/cli-auth';
import { agentActor } from '$lib/server/repos/actor';
import { MCP_AGENT_KEY } from '$lib/server/motion/ask';
import { RenderAsk, RenderMode, requestRender } from '$lib/server/motion/agent-render';
import { RenderRefusal } from '$lib/server/motion/render-run';
import { Preset, settingsOf, settingsSchema } from '$lib/motion/export-formats';
import type { RequestHandler } from './$types';

const HTTP_CREATED = 201;
const HTTP_ACCEPTED = 202;
const HTTP_BAD_REQUEST = 400;
const HTTP_PAYMENT_REQUIRED = 402;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNAVAILABLE = 503;

const bodySchema = z.object({
  mode: z.enum([RenderMode.Browser, RenderMode.Server]).default(RenderMode.Browser),
  settings: settingsSchema.partial().optional()
});

const STATUS_OF: Record<string, number> = {
  [RenderAsk.NotFound]: HTTP_NOT_FOUND,
  [RenderAsk.Empty]: HTTP_CONFLICT,
  [RenderRefusal.Busy]: HTTP_CONFLICT,
  [RenderRefusal.Unverified]: HTTP_CONFLICT,
  [RenderRefusal.Unsupported]: HTTP_BAD_REQUEST,
  [RenderRefusal.NoCredits]: HTTP_PAYMENT_REQUIRED
};

const CREATED_FOR: Record<RenderMode, number> = { [RenderMode.Browser]: HTTP_CREATED, [RenderMode.Server]: HTTP_ACCEPTED };

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
    return json({ error: 'invalid_settings', detail: body.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
  }

  const mode = body.data.mode;
  if (mode === RenderMode.Server) {
    const gate = await gateOrgAiAction(orgId, apiKeyId ? { id: apiKeyId, name: '', user_id: userId, org_id: orgId, scopes: ['write'] } : undefined);
    if (gate) {
      return gate;
    }
  }

  const settings = { ...settingsOf(Preset.Social), ...body.data.settings };
  const asked = await requestRender(db, { orgId, userId, nodeId: params.nodeId ?? '', mode, settings, origin: url.origin, actor: agentActor(userId, MCP_AGENT_KEY) });
  if (!asked.ok) {
    return json({ error: asked.error, detail: asked.detail }, { status: STATUS_OF[asked.error] ?? HTTP_UNAVAILABLE });
  }
  return json(asked.body, { status: CREATED_FOR[mode] });
};
