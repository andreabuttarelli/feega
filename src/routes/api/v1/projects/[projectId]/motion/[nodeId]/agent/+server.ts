import { json } from '@sveltejs/kit';
import { createUIMessageStream, createUIMessageStreamResponse, streamText, type ModelMessage } from 'ai';
import { z } from 'zod';
import { llmLanguageModel, llmModelForPicker, llmVisionModel } from '$lib/server/llm';
import { extractSdkUsage, logAiCall, withOrgContext } from '$lib/server/ai-log';
import { gateOrgAiAction } from '$lib/server/cli-auth';
import { loadTurns, openNodeThread, promptHistory, saveTurn } from '$lib/server/repos/chat';
import { finishedTurn } from '$lib/server/project-agent/finished-turn';
import { agentActor } from '$lib/server/repos/actor';
import { AGENT_MAX_DURATION_S, agentStopWhen } from '$lib/server/project-agent/limits';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { blockedPrompt } from '$lib/server/moderation/blocked-response';
import { headOrNew, motionAssets, motionTokens, saveMotionDoc } from '$lib/server/motion/editor';
import { createMotionTools, selectionNote, type MotionSession } from '$lib/server/motion/motion-tools';
import { motionAgentPrompt } from '$lib/server/motion/motion-prompt';
import { speakVoiceover } from '$lib/server/motion/voiceover';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { motionAgentScope } from '$lib/server/motion/agent-scope';
import { SELF_CHECK_MAX_STEPS, VIEW_FRAMES, Vision, docTexts, keyFrameTimes, selfCheckDue, selfCheckPrompt, visionStep } from '$lib/server/motion/frames';
import { awaitFrames, framesPrefix, type FrameBucket } from '$lib/server/motion/frame-store';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { FRAMES_REQUEST, type FramesRequest } from '$lib/motion/frames-request';
import type { RequestHandler } from './$types';

export const config = { maxDuration: AGENT_MAX_DURATION_S };

const MOTION_AGENT_KEY = 'motion';

enum Round {
  Edit = 'edit',
  SelfCheck = 'self-check'
}

type Stop = ReturnType<typeof agentStopWhen>;

const selfCheckSpent: Stop = ({ steps }) => steps.length >= SELF_CHECK_MAX_STEPS;

const ROUND_STOPS: Record<Round, (t0: number) => Stop[]> = {
  [Round.Edit]: (t0) => [agentStopWhen(t0)],
  [Round.SelfCheck]: (t0) => [agentStopWhen(t0), selfCheckSpent]
};

type TurnStep = Parameters<typeof finishedTurn>[0][number] & { model: { modelId: string }; usage: unknown };

type Usage = ReturnType<typeof extractSdkUsage>;

function addUsage(a: Usage, b: Usage): Usage {
  const sum = (x?: number, y?: number) => (x == null && y == null ? undefined : (x ?? 0) + (y ?? 0));
  return { inputTokens: sum(a.inputTokens, b.inputTokens), outputTokens: sum(a.outputTokens, b.outputTokens), cachedTokens: sum(a.cachedTokens, b.cachedTokens), thinkingTokens: sum(a.thinkingTokens, b.thinkingTokens) };
}

function usageByModel(steps: TurnStep[]): Map<string, Usage> {
  const byModel = new Map<string, Usage>();
  for (const step of steps) {
    byModel.set(step.model.modelId, addUsage(byModel.get(step.model.modelId) ?? {}, extractSdkUsage(step.usage)));
  }
  return byModel;
}

const bodySchema = z.object({ message: z.string().trim().min(1).max(8000), selection: z.array(z.string()).max(50).default([]) });

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

  const session: MotionSession = { doc: head.doc, baseVersion: head.version, edits: [], selection, frames: new Map(), views: 0, checkedAt: 0 };
  const moderationScope = { orgId, userId: user.id, projectId: project.id, nodeId: motion.record.id, actor };
  const bucket = db.storage.from(CANVAS_ASSET_BUCKET) as unknown as FrameBucket;
  const frameScope = { orgId, projectId: project.id, nodeId: motion.record.id };
  let askPreview: (request: FramesRequest) => void = () => {};

  const tools = createMotionTools({
    session,
    assets,
    newId: () => crypto.randomUUID().slice(0, 8),
    voiceover: (input) => withOrgContext(orgId, () => speakVoiceover(db, { orgId, projectId: project.id, nodeId: motion.record.id, userId: user.id, actor }, input)),
    frames: async (callId, times) => {
      const review = await screenModelInput(db, { profile: ModerationProfile.Standard, texts: docTexts(session.doc), scope: moderationScope });
      if (!review.ok) {
        throw new Error(`frames withheld by the safety review: ${review.error}`);
      }
      askPreview({ callId, times, doc: session.doc });
      return awaitFrames(bucket, framesPrefix(frameScope, callId), times.length);
    }
  });

  const model = llmModelForPicker(null);
  const visionModel = llmVisionModel();
  const vision = visionModel ? Vision.Available : Vision.Missing;
  const toolNames = Object.keys(tools).filter((name) => vision === Vision.Available || name !== VIEW_FRAMES);
  const system = motionAgentPrompt({ brandName: project.brandId ? tokens.name : null, selectionNote: selectionNote(head.doc, selection), vision });
  const t0 = Date.now();
  const opening = [...history, { role: 'user', content: message }] as ModelMessage[];

  const round = (messages: ModelMessage[], kind: Round) =>
    streamText({
      model: llmLanguageModel(model),
      system,
      messages,
      tools,
      activeTools: toolNames,
      stopWhen: ROUND_STOPS[kind](t0),
      prepareStep: ({ steps, messages: current, stepNumber }) => {
        const routed = visionModel ? visionStep({ lastCalls: steps.at(-1)?.toolCalls ?? [], messages: current, frames: session.frames, visionModel }) : undefined;
        const forced = kind === Round.SelfCheck && stepNumber === 0 ? { toolChoice: { type: 'tool' as const, toolName: VIEW_FRAMES } } : {};
        return { ...(routed?.model ? { model: llmLanguageModel(routed.model) } : {}), ...(routed?.messages ? { messages: routed.messages } : {}), ...forced };
      }
    });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      askPreview = (request) => writer.write({ type: FRAMES_REQUEST, data: request });
      const first = round(opening, Round.Edit);
      writer.merge(first.toUIMessageStream({ sendFinish: false, sendReasoning: false }));
      const steps: TurnStep[] = [...(await first.steps)];

      if (selfCheckDue(session, vision)) {
        const times = keyFrameTimes(session.doc);
        const answered = (await first.response).messages as ModelMessage[];
        const check = round([...opening, ...answered, { role: 'user', content: selfCheckPrompt(times) }], Round.SelfCheck);
        writer.merge(check.toUIMessageStream({ sendStart: false, sendReasoning: false }));
        steps.push(...(await check.steps));
      }

      await finishTurn(steps);
    },
    onError: (e) => {
      console.error('[motion-agent] turn failed', e);
      return 'The agent could not finish this turn.';
    }
  });

  async function finishTurn(steps: TurnStep[]) {
    if (session.edits.length) {
      const write = await saveMotionDoc(db, { orgId, nodeId: motion.record.id, expectedVersion: session.baseVersion, doc: session.doc, actor, summary: session.edits.join(', ') });
      if (write.outcome !== RevisionOutcome.Written) {
        console.warn('[motion-agent] revision not saved', { nodeId: motion.record.id, outcome: write.outcome });
      }
    }

    const turn = finishedTurn(steps);
    await saveTurn(db, { orgId, threadId, role: 'assistant', ...turn, actor }).catch((e) => console.error('[motion-agent] assistant turn not saved', { threadId }, e));

    for (const [modelId, usage] of usageByModel(steps)) {
      withOrgContext(orgId, () =>
        logAiCall({
          label: modelId === visionModel ? 'motion-agent-vision' : 'motion-agent',
          provider: 'llm',
          model: modelId,
          ms: Date.now() - t0,
          ok: true,
          orgId,
          userId: user.id,
          threadId,
          projectId: project.id,
          actorKind: 'agent',
          actorId: user.id,
          agentKey: MOTION_AGENT_KEY,
          ...usage
        })
      );
    }
  }

  return createUIMessageStreamResponse({ stream });
};

export const GET: RequestHandler = async ({ params, locals }) => {
  const scope = await motionAgentScope(locals, params);
  if (scope instanceof Response) {
    return scope;
  }
  const { db, user, orgId, project, motion } = scope;

  const threadId = await openNodeThread(db, { orgId, projectId: project.id, nodeId: motion.record.id, userId: user.id, brandId: project.brandId });
  const [messages, head] = await Promise.all([loadTurns(db, { orgId, threadId }), headOrNew(db, { orgId, nodeId: motion.record.id }, motion.node)]);
  return json({ threadId, messages, head: { version: head.version, doc: head.doc, summary: head.summary, actorKind: head.actorKind } });
};
