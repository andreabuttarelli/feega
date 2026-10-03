import { json } from '@sveltejs/kit';
import { streamText, type ModelMessage } from 'ai';
import { z } from 'zod';
import { llmLanguageModel, llmModelForPicker } from '$lib/server/llm';
import { extractSdkUsage, logAiCall, withOrgContext } from '$lib/server/ai-log';
import { gateOrgAiAction } from '$lib/server/cli-auth';
import { listMemberships } from '$lib/server/repos/orgs';
import { findReachableProject } from '$lib/server/projects/lookup';
import { loadTurns, openNodeThread, promptHistory, saveTurn } from '$lib/server/repos/chat';
import { finishedTurn } from '$lib/server/project-agent/finished-turn';
import { agentActor } from '$lib/server/repos/actor';
import { AGENT_MAX_DURATION_S, agentStopWhen } from '$lib/server/project-agent/limits';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { blockedPrompt } from '$lib/server/moderation/blocked-response';
import { findMotionNode, headOrNew, motionAssets, motionTokens, saveMotionDoc } from '$lib/server/motion/editor';
import { createMotionTools, selectionNote, type MotionSession } from '$lib/server/motion/motion-tools';
import { motionAgentPrompt } from '$lib/server/motion/motion-prompt';
import { speakVoiceover } from '$lib/server/motion/voiceover';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import type { RequestHandler } from './$types';

export const config = { maxDuration: AGENT_MAX_DURATION_S };

const MOTION_AGENT_KEY = 'motion';

const bodySchema = z.object({ message: z.string().trim().min(1).max(8000), selection: z.array(z.string()).max(50).default([]) });

async function scopeOf(locals: App.Locals, params: { projectId?: string; nodeId?: string }) {
  const { session, user } = await locals.safeGetSession();
  if (!session?.access_token || !user) {
    return json({ error: 'unauthenticated' }, { status: 401 });
  }
  const db = await locals.db();
  if (!db) {
    return json({ error: 'no_client' }, { status: 500 });
  }
  const memberships = await listMemberships(db, user.id);
  const found = await findReachableProject(db, { projectId: params.projectId ?? '', memberships, userId: user.id });
  if (!found) {
    return json({ error: 'project_not_found' }, { status: 404 });
  }
  const motion = await findMotionNode(db, { orgId: found.orgId, nodeId: params.nodeId ?? '', place: { projectId: found.project.id } });
  if (!motion) {
    return json({ error: 'node_not_found' }, { status: 404 });
  }
  return { db, user, orgId: found.orgId, project: found.project, motion } as const;
}

export const POST: RequestHandler = async ({ request, params, locals }) => {
  const scope = await scopeOf(locals, params);
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

  const userActor = { kind: 'user' as const, id: user.id };
  const actor = agentActor(user.id, MOTION_AGENT_KEY);
  const nodeScope = { orgId, nodeId: motion.record.id };

  const screening = screenModelInput(db, { profile: ModerationProfile.Standard, texts: [message], scope: { orgId, userId: user.id, projectId: project.id, nodeId: motion.record.id, actor: userActor } });
  const [head, tokens, threadId] = await Promise.all([
    headOrNew(db, nodeScope, motion.node),
    motionTokens(db, { orgId, brandId: project.brandId }),
    openNodeThread(db, { orgId, projectId: project.id, nodeId: motion.record.id, userId: user.id, brandId: project.brandId })
  ]);
  const screened = await screening;
  if (!screened.ok) {
    return blockedPrompt(screened.error);
  }

  const assets = await motionAssets({ db, orgId, projectId: project.id, canvasId: motion.record.canvasId, nodeId: motion.record.id });
  const history = promptHistory(await loadTurns(db, { orgId, threadId }));
  await saveTurn(db, { orgId, threadId, role: 'user', content: message, actor: userActor });

  const session: MotionSession = { doc: head.doc, baseVersion: head.version, edits: [], selection };
  const tools = createMotionTools({
    session,
    assets,
    newId: () => crypto.randomUUID().slice(0, 8),
    voiceover: (input) => withOrgContext(orgId, () => speakVoiceover(db, { orgId, projectId: project.id, nodeId: motion.record.id, userId: user.id, actor }, input))
  });

  const model = llmModelForPicker(null);
  const t0 = Date.now();

  const result = streamText({
    model: llmLanguageModel(model),
    system: motionAgentPrompt({ brandName: project.brandId ? tokens.name : null, selectionNote: selectionNote(head.doc, selection) }),
    messages: [...history, { role: 'user', content: message }] as ModelMessage[],
    tools,
    stopWhen: [agentStopWhen(t0)],
    onFinish: async ({ steps, totalUsage }) => {
      if (session.edits.length) {
        const write = await saveMotionDoc(db, { orgId, nodeId: motion.record.id, expectedVersion: session.baseVersion, doc: session.doc, actor, summary: session.edits.join(', ') });
        if (write.outcome !== RevisionOutcome.Written) {
          console.warn('[motion-agent] revision not saved', { nodeId: motion.record.id, outcome: write.outcome });
        }
      }

      const turn = finishedTurn(steps);
      await saveTurn(db, { orgId, threadId, role: 'assistant', ...turn, actor }).catch((e) => console.error('[motion-agent] assistant turn not saved', { threadId }, e));

      withOrgContext(orgId, () =>
        logAiCall({
          label: 'motion-agent',
          provider: 'llm',
          model,
          ms: Date.now() - t0,
          ok: true,
          orgId,
          userId: user.id,
          threadId,
          projectId: project.id,
          actorKind: 'agent',
          actorId: user.id,
          agentKey: MOTION_AGENT_KEY,
          ...extractSdkUsage(totalUsage)
        })
      );
    }
  });

  void result.consumeStream({ onError: (e) => console.error('[motion-agent] turn failed after client left', e) });

  return result.toUIMessageStreamResponse({ sendReasoning: false });
};

export const GET: RequestHandler = async ({ params, locals }) => {
  const scope = await scopeOf(locals, params);
  if (scope instanceof Response) {
    return scope;
  }
  const { db, user, orgId, project, motion } = scope;

  const threadId = await openNodeThread(db, { orgId, projectId: project.id, nodeId: motion.record.id, userId: user.id, brandId: project.brandId });
  const [messages, head] = await Promise.all([loadTurns(db, { orgId, threadId }), headOrNew(db, { orgId, nodeId: motion.record.id }, motion.node)]);
  return json({ threadId, messages, head: { version: head.version, doc: head.doc, summary: head.summary, actorKind: head.actorKind } });
};
