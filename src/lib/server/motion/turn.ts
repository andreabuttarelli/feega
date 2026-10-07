import { styleOf } from '$lib/motion/style';
import { briefAwaits, promptTexts } from '$lib/motion/script-brief';
import { createUIMessageStream, streamText, type ModelMessage, type UIMessageChunk } from 'ai';
import type { Db } from '$lib/server/db/client';
import { llmCodeModel, llmLanguageModel, llmStructured, llmVisionModel } from '$lib/server/llm';
import { fetchImageBytes, uiReader } from '$lib/server/motion/ui-read';
import { PromptCache } from '$lib/server/prompt-cache';
import { reasoningProviderOptions } from '$lib/server/chat-model/catalogue';
import { ensureGatewayModels, gatewayModel, gatewayRate } from '$lib/server/openrouter-models';
import { MOTION_TURN_CAP_USD, Tier, activeTools, openingTier, selfCheckChoice, spentUsd, stepTier, type ForcedTool } from '$lib/server/motion/model-route';
import { extractSdkUsage, logAiCall, withOrgContext } from '$lib/server/ai-log';
import { loadTurns, openNodeThread, promptHistory, saveTurn } from '$lib/server/repos/chat';
import { finishedTurn } from '$lib/server/project-agent/finished-turn';
import { agentActor, type Actor } from '$lib/server/repos/actor';
import { agentStopWhen } from '$lib/server/project-agent/limits';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { blockedPrompt } from '$lib/server/moderation/blocked-response';
import { assetUrls, headOrNew, motionAssets, motionTokens, saveMotionDoc } from '$lib/server/motion/editor';
import { createMotionTools, selectionNote, type MotionSession } from '$lib/server/motion/motion-tools';
import { templateLibrary } from '$lib/server/motion/templates';
import { analyzeSounds, storageAnalysis } from '$lib/server/motion/audio-analysis';
import { motionAgentPrompt } from '$lib/server/motion/motion-prompt';
import { speakVoiceover } from '$lib/server/motion/voiceover';
import { layMusic } from '$lib/server/motion/music';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { brandSources } from '$lib/server/motion/brand-sources';
import { SELF_CHECK_MAX_STEPS, SUMMARY_PROMPT, VIEW_FRAMES, Vision, deliveryBlocked, docTexts, fixPrompt, keyFrameTimes, openErrors, selfCheckPrompt, stillOpenNote, usageByModel, visionStep } from '$lib/server/motion/frames';
import { frameStats } from '$lib/server/motion/frame-stats';
import { awaitFrames, awaitVerdict, framesPrefix, FRAME_POLL_MS, type FrameBucket } from '$lib/server/motion/frame-store';
import { CANVAS_ASSET_BUCKET, SIGNED_URL_TTL_S } from '$lib/server/repos/asset-storage';
import { ASSETS_ADDED, CHECK_REQUEST, FRAMES_REQUEST, type CheckRequest, type FramesRequest } from '$lib/motion/frames-request';
import { rowRequests } from '$lib/server/motion/batch-input';
import { startBatch } from '$lib/server/motion/render-run';
import { motionRenderFarm, motionRenderStorage } from '$lib/server/motion/renderer';
import { Preset, settingsOf } from '$lib/motion/export-formats';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import type { MotionNode } from '$lib/canvas/motion-node';
import { createRenderLink } from './render-link';
import { renderPagePath } from '$lib/motion/render-link';
import { BROWSER_RENDER_CREDITS } from '$lib/motion/render-place';

export const MOTION_AGENT_KEY = 'motion';
const CHECK_WAIT_MS = 90_000;
const NEEDS_EDITOR = 'this needs the motion editor open in a browser to draw frames: nobody has it open for this turn';

export enum Browser {
  Attached = 'attached',
  Absent = 'absent'
}

const BROWSER_VISION: Record<Browser, (visionModel: string | null) => Vision> = {
  [Browser.Attached]: (visionModel) => (visionModel ? Vision.Available : Vision.Missing),
  [Browser.Absent]: () => Vision.Missing
};

const BROWSER_DRAWS: Record<Browser, () => void> = {
  [Browser.Attached]: () => {},
  [Browser.Absent]: () => {
    throw new Error(NEEDS_EDITOR);
  }
};

enum Round {
  Edit = 'edit',
  SelfCheck = 'self-check',
  Summary = 'summary'
}

type Stop = ReturnType<typeof agentStopWhen>;

const CLOSING_RESERVE_MS = 60_000;
export const MAX_DELIVERY_ATTEMPTS = 3;
const STILL_OPEN_ID = 'still-open';

const oneStep: Stop = ({ steps }) => steps.length >= 1;

const selfCheckSpent: Stop = ({ steps }) => steps.length >= SELF_CHECK_MAX_STEPS;

const briefShown: Stop = ({ steps }) => briefAwaits(steps as TurnStep[]);

const ROUND_STOPS: Record<Round, (t0: number, overBudget: Stop) => Stop[]> = {
  [Round.Edit]: (t0, overBudget) => [agentStopWhen(t0 - CLOSING_RESERVE_MS), overBudget, briefShown],
  [Round.SelfCheck]: (t0) => [agentStopWhen(t0), selfCheckSpent],
  [Round.Summary]: () => [oneStep]
};

type Choice = ForcedTool | { toolChoice: 'none' };

type ChoiceInput = { tier: Tier; reasoning: string | null; stepNumber: number };

const ROUND_CHOICE: Record<Round, (input: ChoiceInput) => Choice> = {
  [Round.Edit]: () => ({}),
  [Round.SelfCheck]: (input) => (input.stepNumber === 0 ? selfCheckChoice(input) : {}),
  [Round.Summary]: () => ({ toolChoice: 'none' })
};

type TurnStep = Parameters<typeof finishedTurn>[0][number] & { usage: unknown; finishReason: string };

const closedByModel = (last: TurnStep | undefined) => last?.finishReason === 'stop' && last.text.trim().length > 0;

export type MotionTurnInput = {
  db: Db;
  userId: string;
  orgId: string;
  project: { id: string; brandId: string | null };
  motion: { record: CanvasNodeRecord; node: MotionNode };
  message: string;
  selection: string[];
  model: string;
  reasoning: string | null;
  requester: Actor;
  browser: Browser;
};

export type TurnOutcome = { reply: string; summary: string | null; version: number | null; revision: RevisionOutcome | null; costUsd: number };

export type MotionTurn = { stream: ReadableStream<UIMessageChunk>; done: Promise<TurnOutcome> };

export async function startMotionTurn(input: MotionTurnInput): Promise<MotionTurn | Response> {
  const { db, userId, orgId, project, motion, message, selection, model, reasoning, requester, browser } = input;
  const actor = agentActor(userId, MOTION_AGENT_KEY);
  const nodeScope = { orgId, nodeId: motion.record.id };

  const [head, tokens, threadId] = await Promise.all([
    headOrNew(db, nodeScope, motion.node),
    motionTokens(db, { orgId, brandId: project.brandId }),
    openNodeThread(db, { orgId, projectId: project.id, nodeId: motion.record.id, userId, brandId: project.brandId })
  ]);
  const screened = await screenModelInput(db, { profile: ModerationProfile.Standard, texts: promptTexts(message, head.doc), scope: { orgId, userId, projectId: project.id, nodeId: motion.record.id, actor: requester } });
  if (!screened.ok) {
    return blockedPrompt(screened.error);
  }

  const assets = await motionAssets({ db, orgId, projectId: project.id, canvasId: motion.record.canvasId, nodeId: motion.record.id });
  const history = promptHistory(await loadTurns(db, { orgId, threadId }));
  await saveTurn(db, { orgId, threadId, role: 'user', content: message, actor: requester });

  const knownAssets = assets.length;
  const session: MotionSession = { doc: head.doc, baseVersion: head.version, edits: [], selection, frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const moderationScope = { orgId, userId, projectId: project.id, nodeId: motion.record.id, actor };
  const bucket = db.storage.from(CANVAS_ASSET_BUCKET) as unknown as FrameBucket;
  const frameScope = { orgId, projectId: project.id, nodeId: motion.record.id };
  let askPreview: (request: FramesRequest) => void = () => {};
  let askCheck: (request: CheckRequest) => void = () => {};

  const tools = createMotionTools({
    session,
    assets,
    newId: () => crypto.randomUUID().slice(0, 8),
    templates: templateLibrary(db, { orgId, actor: { kind: 'agent', id: userId, agentKey: MOTION_AGENT_KEY } }),
    ...brandSources(db, { orgId, projectId: project.id, canvasId: motion.record.canvasId, brandId: project.brandId }),
    analysis: async (assetId) => (await analyzeSounds(storageAnalysis(db), { orgId, projectId: project.id }, assets, [assetId]))[assetId] ?? null,
    voiceover: (voice) => withOrgContext(orgId, () => speakVoiceover(db, { orgId, projectId: project.id, nodeId: motion.record.id, userId, actor }, voice)),
    music: (ask) => withOrgContext(orgId, () => layMusic(db, { orgId, projectId: project.id, nodeId: motion.record.id, userId, actor }, ask)),
    frames: async (callId, times) => {
      BROWSER_DRAWS[browser]();
      const review = await screenModelInput(db, { profile: ModerationProfile.Standard, texts: docTexts(session.doc), scope: moderationScope });
      if (!review.ok) {
        throw new Error(`frames withheld by the safety review: ${review.error}`);
      }
      askPreview({ callId, times, doc: session.doc, assets: assets.slice(knownAssets) });
      return awaitFrames(bucket, framesPrefix(frameScope, callId), times.length);
    },
    inspect: frameStats,
    readUi: uiReader({ ask: (q) => withOrgContext(orgId, () => llmStructured({ ...q, model: llmVisionModel() ?? model, label: 'motion-recreate-ui' })), fetchBytes: fetchImageBytes }),
    check: async (callId, doc, name) => {
      BROWSER_DRAWS[browser]();
      const review = await screenModelInput(db, { profile: ModerationProfile.Standard, texts: docTexts(doc), scope: moderationScope });
      if (!review.ok) {
        throw new Error(`the component was withheld by the safety review: ${review.error}`);
      }
      askCheck({ callId, name, doc, assets: assets.slice(knownAssets) });
      return awaitVerdict(bucket, framesPrefix(frameScope, callId), { timeoutMs: CHECK_WAIT_MS, pollMs: FRAME_POLL_MS });
    },
    renderLink: async () => {
      if (session.edits.length) {
        return { ok: false, error: 'this turn has unsaved edits: the link renders the saved video, so finish the turn and run render_video in the next one' };
      }
      const link = await createRenderLink(db, { orgId, nodeId: motion.record.id, version: head.version, actor });
      return { ok: true, render_url: renderPagePath(link.token), expires_at: link.expiresAt, credits: BROWSER_RENDER_CREDITS };
    },
    batch: async ({ rows }) => {
      if (session.edits.length) {
        return { ok: false, error: 'this turn has unsaved edits: the batch renders the saved video, so finish the turn and run render_batch in the next one' };
      }
      const renderAssets = await motionAssets({ db, orgId, projectId: project.id, canvasId: motion.record.canvasId, nodeId: motion.record.id }, SIGNED_URL_TTL_S.render);
      const made = rowRequests(head, rows, { tokens, assets: assetUrls(renderAssets) }, settingsOf(Preset.Social));
      if (!made.ok) {
        return made;
      }
      const editorUrl = `/p/${project.id}/c/${motion.record.canvasId}/motion/${motion.record.id}`;
      return startBatch(db, motionRenderFarm(), { ...nodeScope, projectId: project.id, userId, editorUrl }, made.rows, motionRenderStorage());
    }
  });

  const codeModel = llmCodeModel();
  const opening = openingTier({ message, doc: head.doc, selection });
  await ensureGatewayModels();
  const visionModel = gatewayModel(model)?.usable ? model : llmVisionModel();
  const vision = BROWSER_VISION[browser](visionModel);
  const toolNames = Object.keys(tools).filter((name) => vision === Vision.Available || name !== VIEW_FRAMES);
  const system = motionAgentPrompt({ brandName: project.brandId ? tokens.name : null, selectionNote: selectionNote(head.doc, selection), vision, frame: head.doc, style: styleOf(head.doc) });
  const t0 = Date.now();
  const stepModels: string[] = [];
  const openingMessages = [...history, { role: 'user', content: message }] as ModelMessage[];
  const stepTiers: Tier[] = [];
  let spent = 0;
  const overBudget: Stop = () => spent > MOTION_TURN_CAP_USD;
  const TIER_MODEL: Record<Tier, string> = { [Tier.Edit]: model, [Tier.Code]: codeModel };

  const round = (messages: ModelMessage[], kind: Round, onStep: (step: TurnStep & { response: { messages: unknown[] } }) => void) =>
    streamText({
      model: llmLanguageModel(model, PromptCache.On),
      system,
      messages,
      tools,
      activeTools: toolNames,
      stopWhen: ROUND_STOPS[kind](t0, overBudget),
      onStepFinish: (step) => {
        spent += spentUsd([extractSdkUsage(step.usage)], [stepModels.at(-1) ?? model], gatewayRate);
        onStep(step);
      },
      prepareStep: ({ steps, messages: current, stepNumber }) => {
        const tier = stepTier(stepTiers.at(-1) ?? opening, steps.map((s) => s.toolCalls));
        stepTiers.push(tier);
        const tierModel = TIER_MODEL[tier];
        const routed = visionModel ? visionStep({ lastCalls: steps.at(-1)?.toolCalls ?? [], messages: current, frames: session.frames, visionModel: tier === Tier.Code ? codeModel : visionModel }) : undefined;
        const stepModel = routed?.model ?? tierModel;
        stepModels.push(stepModel);
        const forced = ROUND_CHOICE[kind]({ tier, reasoning: stepModel === model ? reasoning : null, stepNumber });
        return { model: llmLanguageModel(stepModel, PromptCache.On), providerOptions: stepModel === model ? reasoningProviderOptions(reasoning) : {}, activeTools: activeTools(tier, toolNames), ...(routed?.messages ? { messages: routed.messages } : {}), ...forced };
      }
    });

  let settle: (outcome: TurnOutcome) => void = () => {};
  let abandon: (e: unknown) => void = () => {};
  const done = new Promise<TurnOutcome>((resolve, reject) => {
    settle = resolve;
    abandon = reject;
  });
  done.catch(() => {});

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      askPreview = (request) => writer.write({ type: FRAMES_REQUEST, data: request });
      askCheck = (request) => writer.write({ type: CHECK_REQUEST, data: request });
      const steps: TurnStep[] = [];
      let conversation = openingMessages;

      const play = async (messages: ModelMessage[], kind: Round) => {
        const answered: ModelMessage[] = [];
        const played = round(messages, kind, (step) => {
          steps.push(step);
          answered.push(...(step.response.messages as ModelMessage[]));
        });
        writer.merge(played.toUIMessageStream({ sendStart: kind === Round.Edit, sendFinish: false, sendReasoning: true }));
        await Promise.resolve(played.steps).catch((e: unknown) => {
          console.error(`[motion-agent] ${kind} round failed, keeping the steps it finished`, e);
        });
        conversation = [...messages, ...answered];
      };

      await play(openingMessages, Round.Edit);
      const awaitsGo = briefAwaits(steps);
      for (let attempt = 0; attempt < MAX_DELIVERY_ATTEMPTS && !awaitsGo && steps.length && deliveryBlocked(session, vision); attempt++) {
        const errors = openErrors(session);
        const times = keyFrameTimes(session.doc);
        await play([...conversation, { role: 'user', content: errors.length ? fixPrompt(errors, times) : selfCheckPrompt(times) }], Round.SelfCheck);
      }
      if (steps.length && !awaitsGo && !closedByModel(steps.at(-1))) {
        await play([...conversation, { role: 'user', content: SUMMARY_PROMPT }], Round.Summary);
      }
      const open = awaitsGo ? '' : stillOpenNote(openErrors(session));
      if (open) {
        writer.write({ type: 'text-start', id: STILL_OPEN_ID });
        writer.write({ type: 'text-delta', id: STILL_OPEN_ID, delta: open });
        writer.write({ type: 'text-end', id: STILL_OPEN_ID });
      }
      writer.write({ type: 'finish' });

      if (assets.length > knownAssets) {
        writer.write({ type: ASSETS_ADDED, data: { assets: assets.slice(knownAssets) } });
      }
      settle(await finishTurn(steps));
    },
    onError: (e) => {
      console.error('[motion-agent] turn failed', e);
      abandon(e);
      return 'The agent could not finish this turn.';
    }
  });

  const labelOf = (modelId: string) => (modelId === model ? 'motion-agent' : modelId === codeModel ? 'motion-agent-code' : 'motion-agent-vision');

  async function finishTurn(steps: TurnStep[]): Promise<TurnOutcome> {
    const write = session.edits.length
      ? await saveMotionDoc(db, { orgId, nodeId: motion.record.id, expectedVersion: session.baseVersion, doc: session.doc, actor, summary: session.edits.join(', ') })
      : null;
    if (write && write.outcome !== RevisionOutcome.Written) {
      console.warn('[motion-agent] revision not saved', { nodeId: motion.record.id, outcome: write.outcome });
    }

    const finished = finishedTurn(steps);
    const turn = { ...finished, content: finished.content + (briefAwaits(steps) ? '' : stillOpenNote(openErrors(session))) };
    await saveTurn(db, { orgId, threadId, role: 'assistant', ...turn, actor }).catch((e) => console.error('[motion-agent] assistant turn not saved', { threadId }, e));

    for (const [modelId, usage] of usageByModel(steps.map((s) => extractSdkUsage(s.usage)), stepModels)) {
      withOrgContext(orgId, () =>
        logAiCall({
          label: labelOf(modelId),
          provider: 'llm',
          model: modelId,
          ms: Date.now() - t0,
          ok: true,
          orgId,
          userId,
          threadId,
          projectId: project.id,
          actorKind: 'agent',
          actorId: userId,
          agentKey: MOTION_AGENT_KEY,
          ...usage
        })
      );
    }

    const written = write?.outcome === RevisionOutcome.Written ? write.head : null;
    return { reply: turn.content, summary: written ? session.edits.join(', ') : null, version: written?.version ?? null, revision: write?.outcome ?? null, costUsd: spent };
  }

  return { stream, done };
}
