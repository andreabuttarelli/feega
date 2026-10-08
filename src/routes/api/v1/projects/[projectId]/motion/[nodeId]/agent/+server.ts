import { json } from '@sveltejs/kit';
import { createUIMessageStreamResponse } from 'ai';
import { z } from 'zod';
import { offeredChatModels, resolveChoice } from '$lib/server/chat-model/catalogue';
import { gateOrgAiAction } from '$lib/server/cli-auth';
import { loadTurns, openNodeThread, turnRunning } from '$lib/server/repos/chat';
import { runInBackground } from '$lib/server/background-work';
import { AGENT_MAX_DURATION_S } from '$lib/server/project-agent/limits';
import { headOrNew } from '$lib/server/motion/editor';
import { motionAgentScope } from '$lib/server/motion/agent-scope';
import { Browser, startMotionTurn } from '$lib/server/motion/turn';
import type { RequestHandler } from './$types';

export const config = { maxDuration: AGENT_MAX_DURATION_S };

const bodySchema = z.object({ message: z.string().trim().min(1).max(8000), selection: z.array(z.string()).max(50).default([]), model: z.unknown().optional(), reasoning: z.unknown().optional() });

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
    return json({ error: 'empty_message' }, { status: 400 });
  }
  const { message, selection } = body.data;

  const resolved = resolveChoice(await offeredChatModels(), { model: body.data.model, reasoning: body.data.reasoning });
  if (!resolved.ok) {
    return json({ error: resolved.error }, { status: 400 });
  }
  const { model, reasoning } = resolved.choice;

  const turn = await startMotionTurn({ db, userId: user.id, orgId, project, motion, message, selection, model, reasoning, requester: { kind: 'user', id: user.id }, browser: Browser.Attached });
  if (turn instanceof Response) {
    return turn;
  }
  runInBackground(() => turn.done, 'motion-turn');
  return createUIMessageStreamResponse({ stream: turn.stream });
};

export const GET: RequestHandler = async ({ params, locals }) => {
  const scope = await motionAgentScope(locals, params);
  if (scope instanceof Response) {
    return scope;
  }
  const { db, user, orgId, project, motion } = scope;

  const threadId = await openNodeThread(db, { orgId, projectId: project.id, nodeId: motion.record.id, userId: user.id, brandId: project.brandId });
  const [messages, running, head] = await Promise.all([loadTurns(db, { orgId, threadId }), turnRunning(db, { orgId, threadId }), headOrNew(db, { orgId, nodeId: motion.record.id }, motion.node)]);
  return json({ threadId, messages, running, head: { version: head.version, doc: head.doc, summary: head.summary, actorKind: head.actorKind } });
};
