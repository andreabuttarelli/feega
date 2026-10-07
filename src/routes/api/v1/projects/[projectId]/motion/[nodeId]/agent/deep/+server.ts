import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { offeredChatModels, resolveChoice } from '$lib/server/chat-model/catalogue';
import { gateOrgAiAction } from '$lib/server/cli-auth';
import { motionAgentScope } from '$lib/server/motion/agent-scope';
import { latestDeep } from '$lib/server/repos/deep-runs';
import { deepView } from '$lib/server/motion/deep/job';
import { DeepRefusal, startDeep } from '$lib/server/motion/deep/start';
import { DEEP_MAX_DURATION_S } from '$lib/server/motion/deep/limits';
import type { RequestHandler } from './$types';

export const config = { maxDuration: DEEP_MAX_DURATION_S };

const HTTP_BAD_REQUEST = 400;
const HTTP_PAYMENT_REQUIRED = 402;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE = 422;

const REFUSAL_STATUS: Record<DeepRefusal, number> = {
  [DeepRefusal.Credits]: HTTP_PAYMENT_REQUIRED,
  [DeepRefusal.Running]: HTTP_CONFLICT,
  [DeepRefusal.Blocked]: HTTP_UNPROCESSABLE
};

const bodySchema = z.object({ message: z.string().trim().min(1).max(8000), model: z.unknown().optional(), reasoning: z.unknown().optional() });

export const GET: RequestHandler = async ({ params, locals }) => {
  const scope = await motionAgentScope(locals, params);
  if (scope instanceof Response) {
    return scope;
  }
  const run = await latestDeep(scope.db, { orgId: scope.orgId, nodeId: scope.motion.record.id });
  return json({ job: run ? deepView(run) : null });
};

export const POST: RequestHandler = async ({ request, params, locals }) => {
  const scope = await motionAgentScope(locals, params);
  if (scope instanceof Response) {
    return scope;
  }
  const { db, user, orgId, project, motion } = scope;

  const gated = await gateOrgAiAction(orgId, undefined);
  if (gated) {
    return gated;
  }

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: 'empty_message' }, { status: HTTP_BAD_REQUEST });
  }
  const resolved = resolveChoice(await offeredChatModels(), { model: body.data.model, reasoning: body.data.reasoning });
  if (!resolved.ok) {
    return json({ error: resolved.error }, { status: HTTP_BAD_REQUEST });
  }

  const started = await startDeep(db, { orgId, userId: user.id, project, nodeId: motion.record.id, message: body.data.message, model: resolved.choice.model, requester: { kind: 'user', id: user.id } });
  if (!started.ok) {
    return json({ error: started.error }, { status: REFUSAL_STATUS[started.error] });
  }
  return json({ job: started.view });
};
