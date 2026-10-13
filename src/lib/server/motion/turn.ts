import { styleOf } from '$lib/motion/style';
import { briefAwaits, promptTexts } from '$lib/motion/script-brief';
import { ASK_REFERENCE_PICK, avoidedImages, choosesForUser, latestAnswer, pickAwaits, readAnswer, rejectedRounds, shownRefs, savedPick, type PickAnswer, type PickAsk } from '$lib/reference-pick';
import { createUIMessageStream, streamText, type ModelMessage, type Tool, type UIMessageChunk } from 'ai';
import type { SpawnInput } from '$lib/server/agents/spawn';
import { spawnAgents, spawnOffers } from '$lib/server/agents/spawn-agent';
import { toolsWritingCode } from '$lib/server/motion/model-route';
import type { Db } from '$lib/server/db/client';
import { llmCodeModel, llmLanguageModel, llmStructured, llmVisionModel, type LlmMediaPart } from '$lib/server/llm';
import { fetchImageBytes, uiReader } from '$lib/server/motion/ui-read';
import { PromptCache } from '$lib/server/prompt-cache';
import { reasoningProviderOptions, toolForcing } from '$lib/server/chat-model/catalogue';
import { ensureGatewayModels, gatewayModel, gatewayRate } from '$lib/server/openrouter-models';
import { Tier, activeTools, openingTier, selfCheckChoice, spentUsd, stepTier, type ForcedTool } from '$lib/server/motion/model-route';
import { billedUsdInScope, billingScope, extractSdkUsage, logAiCall, withNodeContext, withOrgContext } from '$lib/server/ai-log';
import { loadTurns, openNodeThread, promptHistory, saveTurn } from '$lib/server/repos/chat';
import { openReply, ReplyStatus, type Reply } from '$lib/server/repos/chat-reply';
import { referencedAssets } from '$lib/motion/doc-assets';
import { finishedTurn } from '$lib/server/project-agent/finished-turn';
import { agentActor, type Actor } from '$lib/server/repos/actor';
import { agentStopWhen } from '$lib/server/project-agent/limits';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { blockedPrompt } from '$lib/server/moderation/blocked-response';
import { drawFrames, firstFrames } from '$lib/server/motion/server-frames';
import { chromiumFrames, chromiumGl, serverFramesOpen } from '$lib/server/motion/chromium-frames';
import { effectStore } from '$lib/server/effects/store';
import { layoutStore } from '$lib/server/layouts/store';
import { assetUrls, headOrNew, motionAssets, motionTokens, saveMotionDoc } from '$lib/server/motion/editor';
import { fitNewVideo } from '$lib/motion/fit-duration';
import { sizedToBrief } from '$lib/motion/brief-canvas';
import { AGENT_SELF_SAVE_MS } from '$lib/server/project-agent/limits';
import { Reserve, VIDEO_BUDGET, budgetCard, budgetNote, budgetSpent, readVideoBudget, turnBudgetUsd, videoBudget, type BudgetCard } from '$lib/server/motion/video-budget';
import { CRITIC_SCHEMA, critique, criticMessage, type Critique } from '$lib/server/motion/critic';
import { VIEWER_MODEL, VIEWER_SCHEMA, viewFrames } from '$lib/server/motion/viewer';
import { CutGate, KEPT_CUT, REVIEW_CUT, cutGate, keepsCut, reviewedBefore, type CutReview } from '$lib/motion/cut-review';
import type { SavedTool } from '$lib/server/repos/chat';
import { tileSheet } from '$lib/server/motion/contact-sheet';
import { COPY_SCHEMA, copywrite } from '$lib/server/motion/copywriter';
import { projectMemory } from '$lib/server/motion/studio-memory';
import type { LaunchScript } from '$lib/motion/script';
import { DRAWS_FIX_RESERVE, REVIEWED, STUDIO_ROSTER, StudioRole, roleBudgetUsd, roleLooks, roleModel, roleTools, turnRole } from '$lib/server/motion/studio-roster';
import { Looks, ownLook } from '$lib/server/motion/look';
import { dropWorkingDoc, keepWorkingDoc } from '$lib/server/motion/working-doc';
import { appAccountKept, liveWebDeps, productImport, screenedImport, uiCapture, webViewPrefix } from '$lib/server/web/live';
import { CAPTURE_MAX_EDGE, storeImage } from './asset-import';
import { ATTACHMENT_PORTS } from '$lib/server/chat-attachments/register';
import { EmbedAction, createMotionTools, selectionNote, type MotionSession, type MotionToolDeps } from '$lib/server/motion/motion-tools';
import type { MotionAsset } from '$lib/server/motion/editor';
import { publishEmbed, removeEmbed } from '$lib/server/motion/embed';
import type { ProjectMode } from '$lib/project-mode';
import { templateLibrary } from '$lib/server/motion/templates';
import { analyzeSounds, storageAnalysis } from '$lib/server/motion/audio-analysis';
import { motionAgentPrompt } from '$lib/server/motion/motion-prompt';
import { speakVoiceover } from '$lib/server/motion/voiceover';
import { layMusic } from '$lib/server/motion/music';
import { laySfx } from '$lib/server/motion/sfx';
import { RevisionOutcome, listRevisions, readRevision } from '$lib/server/repos/motion-revisions';
import { brandSources } from '$lib/server/motion/brand-sources';
import { storyboardStore } from '$lib/server/motion/storyboard';
import { boardNote } from '$lib/motion/storyboard';
import { DESCRIBE_FRAMES, SELF_CHECK_MAX_STEPS, SUMMARY_PROMPT, VIEW_FRAMES, Vision, deliveryBlocked, docTexts, checkMessage, keyFrameTimes, openErrors, selfCheckDue, stillOpenNote, finalReply, viewedReferences, usageByModel, visionStep, type Frame } from '$lib/server/motion/frames';
import { frameDensities, frameStats, seamLuma } from '$lib/server/motion/frame-stats';
import { awaitFrames, awaitVerdict, framesPrefix, FRAME_POLL_MS, type FrameBucket } from '$lib/server/motion/frame-store';
import { CANVAS_ASSET_BUCKET, SIGNED_URL_TTL_S, storeAssetFile } from '$lib/server/repos/asset-storage';
import { ASSETS_ADDED, CHECK_REQUEST, DOC_EDITED, FRAMES_REQUEST, type CheckRequest, type FramesRequest } from '$lib/motion/frames-request';
import { rowRequests } from '$lib/server/motion/batch-input';
import { startFarmBatch } from '$lib/server/motion/render-start';
import { Preset, settingsOf, type Quality } from '$lib/motion/export-formats';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import type { MotionNode } from '$lib/canvas/motion-node';
import { createRenderLink } from './render-link';
import { renderPagePath } from '$lib/motion/render-link';
import { BROWSER_RENDER_CREDITS } from '$lib/motion/render-place';
import type { ChatAttachment } from '$lib/chat-attachments';
import { motionPlaceHint, userContent } from '$lib/server/chat-attachments/model-parts';

export const MOTION_AGENT_KEY = 'motion';
const CHECK_WAIT_MS = 90_000;
const SIZED_TO_BRIEF = 'sized the video to the brief';
const NEEDS_EDITOR = 'this needs the motion editor open in a browser to draw frames: nobody has it open for this turn';

export enum Browser {
  Attached = 'attached',
  Absent = 'absent'
}

const BROWSER_VISION: Record<Browser, (visionModel: string | null) => Vision> = {
  [Browser.Attached]: (visionModel) => (visionModel ? Vision.Available : Vision.Missing),
  [Browser.Absent]: (visionModel) => (visionModel && serverFramesOpen() ? Vision.Available : Vision.Missing)
};

const EDITOR_DRAWS: Record<Browser, boolean> = { [Browser.Attached]: true, [Browser.Absent]: false };

const BROWSER_DRAWS: Record<Browser, () => void> = {
  [Browser.Attached]: () => {},
  [Browser.Absent]: () => {
    throw new Error(NEEDS_EDITOR);
  }
};

enum Client {
  Watching = 'watching',
  Gone = 'gone'
}

enum Round {
  Research = 'research',
  Sound = 'sound',
  Edit = 'edit',
  SelfCheck = 'self-check',
  Summary = 'summary'
}

type Stop = ReturnType<typeof agentStopWhen>;

const CLOSING_RESERVE_MS = 60_000;
const SAVE_ATTEMPTS = 4;

export type TurnTiming = { landingMs: number; stopPollMs: number };

const PLATFORM_TIMING: TurnTiming = { landingMs: AGENT_SELF_SAVE_MS, stopPollMs: 3000 };
export const MAX_DELIVERY_ATTEMPTS = 3;
const STILL_OPEN_ID = 'still-open';
const LAST_LOOK_ID = 'last-look';
const CRITIC_ID = 'critic-sheet';
const LOOP_SEAM_ID = 'loop-seam';
const CUT_REVIEW_ID = 'cut-review';
const SHEET_FILE = 'sheet.jpg';

const oneStep: Stop = ({ steps }) => steps.length >= 1;

const selfCheckSpent: Stop = ({ steps }) => steps.length >= SELF_CHECK_MAX_STEPS;

const awaitsUser = (steps: readonly TurnStep[]) => briefAwaits(steps) || pickAwaits(steps);

const userAsked: Stop = ({ steps }) => awaitsUser(steps as TurnStep[]);

const ROUND_ROLE: Record<Round, StudioRole | null> = { [Round.Research]: StudioRole.Researcher, [Round.Sound]: StudioRole.Sound, [Round.Edit]: null, [Round.SelfCheck]: null, [Round.Summary]: null };

const CREWS = 2;

type Crew = { acts: string[]; from: number; to: number };

function shotCrews(script: LaunchScript): Crew[] {
  const size = Math.ceil(script.acts.length / CREWS);
  return Array.from({ length: CREWS }, (_, i) => script.acts.slice(i * size, (i + 1) * size))
    .filter((acts) => acts.length)
    .map((acts) => ({ acts: acts.map((a) => a.act), from: acts[0].start, to: acts.at(-1)!.end }));
}

const ADD_SHOT = 'add_shot';

function crewTools<T extends Record<string, Tool>>(all: T, crew: Crew): T {
  const add = all[ADD_SHOT];
  if (!add?.execute) {
    return all;
  }
  const guarded: Tool = {
    ...add,
    execute: async (input: { at: number; seconds?: number }, options) =>
      input.at < crew.from || input.at >= crew.to ? { ok: false, error: `a shot at ${input.at} s is outside your range ${crew.from} s to ${crew.to} s: the other crew builds that part` } : add.execute!(input, options)
  } as Tool;
  return { ...all, [ADD_SHOT]: guarded };
}

const crewBrief = (crew: Crew) => `Shot crew: build only the ${crew.acts.join(', ')} acts of the script, from ${crew.from} s to ${crew.to} s, with library shots placed inside that range. Another crew builds the rest at the same time: never place, move or remove anything outside your range, and leave music to the sound pass.`;

const RESEARCH_DONE = 'Research is done: the facts, captures and references are in the conversation above. Now write the script and the storyboard from them.';
const SOUND_PASS = 'Sound pass: lay the music under the whole video if there is none, mark its beats and cut the shots onto them. Change nothing else.';

const ROUND_STOPS: Record<Round, (t0: number, overBudget: Stop) => Stop[]> = {
  [Round.Research]: (t0, overBudget) => [agentStopWhen(t0 - CLOSING_RESERVE_MS), overBudget, userAsked],
  [Round.Sound]: (t0, overBudget) => [agentStopWhen(t0), overBudget, selfCheckSpent],
  [Round.Edit]: (t0, overBudget) => [agentStopWhen(t0 - CLOSING_RESERVE_MS), overBudget, userAsked],
  [Round.SelfCheck]: (t0, overBudget) => [agentStopWhen(t0), selfCheckSpent, overBudget],
  [Round.Summary]: () => [oneStep]
};

type Choice = ForcedTool | { toolChoice: 'none' };

type ChoiceInput = Parameters<typeof selfCheckChoice>[0] & { stepNumber: number };

const ROUND_CHOICE: Record<Round, (input: ChoiceInput) => Choice> = {
  [Round.Research]: () => ({}),
  [Round.Sound]: () => ({}),
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
  project: { id: string; brandId: string | null; mode: ProjectMode };
  motion: { record: CanvasNodeRecord; node: MotionNode };
  message: string;
  attachments?: ChatAttachment[];
  selection: string[];
  model: string;
  reasoning: string | null;
  requester: Actor;
  browser: Browser;
  timing?: TurnTiming;
};

type Followed = { ids: string[]; note: string };

async function importFollowed(answer: PickAnswer | null, importAsset: MotionToolDeps['importAsset'], assets: MotionAsset[]): Promise<Followed> {
  if (!answer?.follow.length || !importAsset) {
    return { ids: [], note: '' };
  }
  const landed = await Promise.all(answer.follow.map(async (c) => ({ c, out: await importAsset(c.image, c.title) })));
  const ok = landed.flatMap(({ c, out }) => (out.ok ? [{ c, asset: out.asset }] : []));
  assets.push(...ok.map((o) => o.asset));
  const lines = ok.map(({ c, asset }) => `- ${c.title || c.id}: asset ${asset.id}`);
  return { ids: ok.map((o) => o.asset.id), note: lines.length ? `The references the user follows are now project assets: hang each under the storyboard beat it inspires (write_storyboard media) and take the look from them:\n${lines.join('\n')}` : '' };
}

export type TurnOutcome = { reply: string; summary: string | null; version: number | null; revision: RevisionOutcome | null; costUsd: number; pick: PickAsk | null; cut: CutReview | null; budget: BudgetCard | null };

export type MotionTurn = { stream: ReadableStream<UIMessageChunk>; done: Promise<TurnOutcome> };

const CANNED_ID = 'canned';
const BUDGET_ID = 'video-budget';

const budgetTool = (card: BudgetCard): SavedTool => ({ toolCallId: BUDGET_ID, toolName: VIDEO_BUDGET, status: 'done', input: {}, output: card });

function writeCard(writer: { write: (chunk: UIMessageChunk) => void }, card: BudgetCard): void {
  writer.write({ type: 'tool-input-available', toolCallId: BUDGET_ID, toolName: VIDEO_BUDGET, input: {} });
  writer.write({ type: 'tool-output-available', toolCallId: BUDGET_ID, output: card });
}

function writeText(writer: { write: (chunk: UIMessageChunk) => void }, id: string, text: string): void {
  writer.write({ type: 'text-start', id });
  writer.write({ type: 'text-delta', id, delta: text });
  writer.write({ type: 'text-end', id });
}

function cannedTurn(content: string, reply: Pick<Reply, 'finish'>, card: BudgetCard | null = null): MotionTurn {
  const done = reply.finish({ content, tools: card ? [budgetTool(card)] : [] }, ReplyStatus.Done).then((): TurnOutcome => ({ reply: content, summary: null, version: null, revision: null, costUsd: 0, pick: null, cut: null, budget: card }));
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: 'start' });
      writeText(writer, CANNED_ID, content);
      if (card) {
        writeCard(writer, card);
      }
      writer.write({ type: 'finish' });
    }
  });
  return { stream, done };
}

export const startMotionTurn = (input: MotionTurnInput): Promise<MotionTurn | Response> => withNodeContext(input.motion.record.id, () => openMotionTurn(input));

async function openMotionTurn(input: MotionTurnInput): Promise<MotionTurn | Response> {
  const startedAt = Date.now();
  const { db, userId, orgId, project, motion, message, attachments = [], selection, model, reasoning, requester, browser, timing = PLATFORM_TIMING } = input;
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
  const turns = await loadTurns(db, { orgId, threadId });
  const history = promptHistory(turns);
  const pick = readAnswer(message) ?? latestAnswer(turns);
  await saveTurn(db, { orgId, threadId, role: 'user', content: message, attachments, actor: requester });
  const storyboard = storyboardStore(db, { orgId, projectId: project.id, motionNodeId: motion.record.id, title: motion.record.displayName ?? 'Video', actor });
  const note = motion.node.storyboard ? boardNote(await storyboard.read()) : null;
  const reply = await openReply(db, { orgId, threadId, actor });
  const raisedUsd = motion.node.budgetRaisedUsd ?? 0;
  const budget = await readVideoBudget(db, nodeScope, raisedUsd).catch(() => videoBudget(0, raisedUsd));
  const role = turnRole(message, head.doc);
  const reserve = DRAWS_FIX_RESERVE.has(role) ? Reserve.Drawn : Reserve.Kept;
  if (budgetSpent(budget, reserve)) {
    const card = budgetCard(budget);
    return cannedTurn(budgetNote(card), reply, card);
  }
  const turnCapUsd = turnBudgetUsd(budget, reserve);
  if (keepsCut(message)) {
    return cannedTurn(KEPT_CUT, reply);
  }

  const knownAssets = assets.length;
  const briefed = sizedToBrief(head.doc, message);
  const session: MotionSession = { doc: briefed ?? head.doc, baseVersion: head.version, edits: briefed ? [SIZED_TO_BRIEF] : [], selection, frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0, pick };
  const moderationScope = { orgId, userId, projectId: project.id, nodeId: motion.record.id, actor };
  const bucket = db.storage.from(CANVAS_ASSET_BUCKET) as unknown as FrameBucket;
  const frameScope = { orgId, projectId: project.id, nodeId: motion.record.id };
  let askPreview: (request: FramesRequest) => void = () => {};
  let askCheck: (request: CheckRequest) => void = () => {};
  let announced = 0;
  let announce: () => void = () => {};
  let client = Client.Watching;
  const cut = new AbortController();

  const screenPicture = (url: string) => ATTACHMENT_PORTS.screenImage({ orgId, mode: project.mode, url });
  const sources = brandSources(db, { orgId, userId, projectId: project.id, canvasId: motion.record.canvasId, brandId: project.brandId, screen: screenPicture }, (usd) => {
    spent += usd;
  });
  const picked = await importFollowed(readAnswer(message), sources.importAsset, assets);
  session.pickAssets = picked.ids;
  const openingRound = role === StudioRole.Director ? Round.Research : Round.Edit;
  const memory = role === StudioRole.Director ? await projectMemory(db, { orgId, projectId: project.id, nodeId: motion.record.id }).catch(() => '') : '';
  const openingText = [message, note, picked.note, memory].filter(Boolean).join('\n\n');
  const openingContent = await userContent(db, { orgId, text: openingText, attachments, hint: motionPlaceHint });
  let seamDraws = 0;
  const drawTurnFrames = async (callId: string, times: number[]) => {
    const review = await screenModelInput(db, { profile: ModerationProfile.Standard, texts: docTexts(session.doc), scope: moderationScope });
    if (!review.ok) {
      throw new Error(`frames withheld by the safety review: ${review.error}`);
    }
    const editor = async () => {
      if (!EDITOR_DRAWS[browser] || client === Client.Gone) {
        return null;
      }
      askPreview({ callId, times, doc: session.doc, assets: assets.slice(knownAssets) });
      return awaitFrames(bucket, framesPrefix(frameScope, callId), times.length);
    };
    const server = async () => (serverFramesOpen() ? drawFrames(chromiumFrames, { compose: { doc: session.doc, tokens, assets: assetUrls(assets) }, times }) : null);
    return firstFrames([editor, server]);
  };

  let spawnRun: (input: SpawnInput) => Promise<Record<string, unknown>> = async () => ({ ok: false, error: 'sub-agents start once the turn is running' });
  const offers = spawnOffers();
  const tools = createMotionTools({
    spawn: { offers, run: (input) => spawnRun(input) as never },
    session,
    assets,
    newId: () => crypto.randomUUID().slice(0, 8),
    templates: templateLibrary(db, { orgId, actor: { kind: 'agent', id: userId, agentKey: MOTION_AGENT_KEY } }),
    revisions: { list: () => listRevisions(db, nodeScope), read: async (version) => (await readRevision(db, { ...nodeScope, version }))?.doc ?? null },
    ...sources,
    analysis: async (assetId) => (await analyzeSounds(storageAnalysis(db), { orgId, projectId: project.id }, assets, [assetId]))[assetId] ?? null,
    voiceover: (voice) => withOrgContext(orgId, () => speakVoiceover(db, { orgId, projectId: project.id, nodeId: motion.record.id, userId, actor }, voice)),
    music: (ask) => withOrgContext(orgId, () => layMusic(db, { orgId, projectId: project.id, nodeId: motion.record.id, userId, actor }, ask)),
    sfx: (sound) => withOrgContext(orgId, () => laySfx(db, { orgId, projectId: project.id, nodeId: motion.record.id, userId, actor }, sound)),
    frames: drawTurnFrames,
    inspect: frameStats,
    seam: async () => {
      const end = session.doc.durationInFrames / session.doc.fps;
      const frames = await drawTurnFrames(`${LOOP_SEAM_ID}-${seamDraws++}`, [0, Math.max(0, end - 1 / session.doc.fps)]);
      return seamLuma(frames?.filter((f) => f.bytes.length > 0) ?? []);
    },
    web: {
      ...liveWebDeps(
        db,
        { orgId, userId, projectId: project.id, brandId: project.brandId, mode: project.mode },
        (usd) => {
          spent += usd;
        },
        async (jpeg, name) => {
          const stored = await storeImage(db, { orgId, projectId: project.id, canvasId: motion.record.canvasId, screen: screenPicture }, { bytes: jpeg, url: name }, name, CAPTURE_MAX_EDGE);
          if (!stored.ok) {
            return null;
          }
          assets.push(stored.asset);
          return stored.asset.id;
        }
      ),
      importProducts: productImport(screenedImport(sources.importAsset, screenPicture, assets)),
      avoid: avoidedImages(pick),
      shown: shownRefs(turns),
      rejections: rejectedRounds([...turns, { role: 'user', content: message }])
    },
    layouts: layoutStore({ db, orgId, actor: { kind: 'agent', id: userId, agentKey: MOTION_AGENT_KEY } }),
    effects: effectStore({ db, orgId, actor: { kind: 'agent', id: userId, agentKey: MOTION_AGENT_KEY }, gl: serverFramesOpen() ? chromiumGl : null }),
    storyboard,
    copywrite: async (script) => {
      const ask = async (prompt: string) => ({ answer: await llmStructured({ prompt, schema: COPY_SCHEMA, model: roleModel(StudioRole.Copywriter, model), temperature: 0.4, label: STUDIO_ROSTER[StudioRole.Copywriter].label }), usd: billedUsdInScope() ?? 0 });
      const out = await withOrgContext(orgId, () => copywrite({ ask }, script));
      spent += out.usd;
      return out.script;
    },
    captureUi: uiCapture(db, { orgId, userId, projectId: project.id, brandId: project.brandId }),
    appAccountKept: appAccountKept(db, { orgId, userId, projectId: project.id, brandId: project.brandId }),
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
    renderLink: async (quality: Quality) => {
      if (session.edits.length) {
        return { ok: false, error: 'this turn has unsaved edits: the link renders the saved video, so finish the turn and run render_video in the next one' };
      }
      const link = await createRenderLink(db, { orgId, nodeId: motion.record.id, version: head.version, quality, actor });
      return { ok: true, render_url: renderPagePath(link.token), expires_at: link.expiresAt, credits: BROWSER_RENDER_CREDITS };
    },
    embed: async (action) => {
      const nodeId = motion.record.id;
      const EMBED_RUN: Record<EmbedAction, () => Promise<Record<string, unknown>>> = {
        [EmbedAction.Publish]: () => publishEmbed(db, { nodeId, doc: session.doc, tokens, assetUrls: assetUrls(assets), title: motion.record.displayName ?? 'feega', fetchBlob: (url) => fetch(url).then((r) => r.blob()), mode: project.mode }),
        [EmbedAction.Unpublish]: () => removeEmbed(db, nodeId)
      };
      return EMBED_RUN[action]();
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
      return startFarmBatch(db, { ...nodeScope, projectId: project.id, userId, editorUrl }, made.rows);
    }
  });

  const codeModel = roleModel(role, llmCodeModel());
  const opening = openingTier({ message, doc: head.doc, selection });
  await ensureGatewayModels();
  const visionModel = gatewayModel(model)?.usable ? model : llmVisionModel();
  const vision = BROWSER_VISION[browser](visionModel);
  const asksPick = !choosesForUser(message);
  const toolNames = roleTools(role, Object.keys(tools)).filter((name) => (vision === Vision.Available || (name !== VIEW_FRAMES && name !== DESCRIBE_FRAMES)) && (asksPick || name !== ASK_REFERENCE_PICK));
  const system = motionAgentPrompt({ brandName: project.brandId ? tokens.name : null, selectionNote: selectionNote(head.doc, selection), vision, frame: session.doc, style: styleOf(head.doc) });
  const t0 = Date.now();
  const stepModels: string[] = [];
  const openingMessages = [...history, { role: 'user', content: openingContent }] as ModelMessage[];
  const stepTiers: Tier[] = [];
  const framesShown = new Set<string>();
  let spent = 0;
  let roundsUsd = 0;
  const billing = billingScope(orgId);
  const charged = () => spent - roundsUsd + Math.max(roundsUsd, billing.gatewayUsd());
  const overBudget: Stop = () => charged() > roleBudgetUsd(role, turnCapUsd);
  const TIER_MODEL: Record<Tier, string> = { [Tier.Edit]: model, [Tier.Code]: codeModel };

  spawnRun = spawnAgents(
    {
      orgId,
      tools: () => Object.fromEntries(toolNames.map((n) => [n, tools[n]])),
      codeTools: toolsWritingCode,
      visionTools: new Set([VIEW_FRAMES]),
      remainingUsd: () => roleBudgetUsd(role, turnCapUsd) - charged(),
      onSpent: (usd) => {
        spent += usd;
      },
      changes: () => session.edits.length,
      changedSince: (mark) => session.edits.slice(mark),
      log: (e) => withOrgContext(orgId, () => logAiCall({ label: `motion-spawned-${e.label}`, provider: 'llm', model: e.model, ms: 0, ok: true, orgId, userId, threadId, projectId: project.id, actorKind: 'agent', actorId: userId, agentKey: e.agentKey, ...e.usage })),
      abort: cut.signal
    },
    offers
  );

  const round = (messages: ModelMessage[], kind: Round, onStep: (step: TurnStep & { response: { messages: unknown[] } }) => void, toolSet: typeof tools = tools) =>
    billing.run(() => streamText({
      model: llmLanguageModel(ROUND_ROLE[kind] ? roleModel(ROUND_ROLE[kind], model) : model, PromptCache.On),
      system,
      messages,
      tools: toolSet,
      abortSignal: cut.signal,
      activeTools: toolNames,
      stopWhen: ROUND_STOPS[kind](t0, overBudget),
      onChunk: ({ chunk }) => {
        if (chunk.type === 'tool-result') {
          announce();
        }
      },
      onStepFinish: (step) => {
        const estimate = spentUsd([extractSdkUsage(step.usage)], [stepModels.at(-1) ?? model], gatewayRate);
        spent += estimate;
        roundsUsd += estimate;
        onStep(step);
      },
      prepareStep: ({ steps, messages: current, stepNumber }) => {
        const seen = viewedReferences(current);
        if (seen.length) {
          session.references = seen;
        }
        const tier = stepTier(stepTiers.at(-1) ?? opening, steps.map((s) => s.toolCalls));
        stepTiers.push(tier);
        const tierModel = TIER_MODEL[tier];
        const routed = visionModel ? visionStep({ messages: current, shown: framesShown, stepModel: tierModel, visionModel: tier === Tier.Code ? codeModel : visionModel }) : undefined;
        routed?.shown?.forEach((id) => framesShown.add(id));
        const stepModel = routed?.model ?? tierModel;
        stepModels.push(stepModel);
        const forced = ROUND_CHOICE[kind]({ tier, reasoning: stepModel === model ? reasoning : null, forcing: toolForcing(stepModel), stepNumber });
        const roundRole = ROUND_ROLE[kind];
        if (roundRole) {
          stepModels[stepModels.length - 1] = roleModel(roundRole, stepModel);
          return { model: llmLanguageModel(stepModels.at(-1)!, PromptCache.On), activeTools: roleTools(roundRole, toolNames) };
        }
        return { model: llmLanguageModel(stepModel, PromptCache.On), providerOptions: stepModel === model ? reasoningProviderOptions(reasoning) : {}, activeTools: activeTools(tier, toolNames), ...(routed?.messages ? { messages: routed.messages } : {}), ...forced };
      }
        }));

  const lastLook = async (messages: ModelMessage[]): Promise<ModelMessage[]> => {
    const view = tools[VIEW_FRAMES];
    const scenes = keyFrameTimes(session.doc);
    const input = { times: scenes.length ? scenes : [session.doc.durationInFrames / session.doc.fps / 2] };
    const output = await view.execute!(input, { toolCallId: LAST_LOOK_ID, messages, context: {} });
    const result = await view.toModelOutput!({ toolCallId: LAST_LOOK_ID, input, output });
    return [
      { role: 'assistant', content: [{ type: 'tool-call', toolCallId: LAST_LOOK_ID, toolName: VIEW_FRAMES, input }] },
      { role: 'tool', content: [{ type: 'tool-result', toolCallId: LAST_LOOK_ID, toolName: VIEW_FRAMES, output: result }] }
    ];
  };

  let sheetBatch = 0;
  const storeSheet = async (bytes: Buffer | null): Promise<string | null> => {
    if (!bytes) {
      return null;
    }
    const path = `${webViewPrefix({ orgId, projectId: project.id }, `${CRITIC_ID}-${crypto.randomUUID().slice(0, 8)}`)}/${SHEET_FILE}`;
    return storeAssetFile(db, path, new File([new Uint8Array(bytes)], SHEET_FILE, { type: 'image/jpeg' }))
      .then(() => path)
      .catch(() => null);
  };

  const gate = cutGate(message, turns);
  const gateTools: SavedTool[] = [];
  const budgetTools: SavedTool[] = [];
  const viewerAsk = async (q: { prompt: string; images: LlmMediaPart[] }) => {
    const answer = await llmStructured({ ...q, schema: VIEWER_SCHEMA, model: gatewayModel(VIEWER_MODEL)?.usable ? VIEWER_MODEL : (visionModel ?? model), temperature: 0, label: STUDIO_ROSTER[StudioRole.Viewer].label });
    return { answer, usd: billedUsdInScope() ?? 0 };
  };
  const reviewCut = async (): Promise<Critique> => {
    const ports = {
      frames: (times: number[]) => drawTurnFrames(`${CRITIC_ID}-${sheetBatch++}`, times),
      tile: tileSheet,
      density: frameDensities,
      ask: async (q: { prompt: string; images: LlmMediaPart[] }) => {
        const answer = await llmStructured({ ...q, schema: CRITIC_SCHEMA, model: roleModel(StudioRole.Critic, visionModel ?? model), temperature: 0, label: STUDIO_ROSTER[StudioRole.Critic].label });
        return { answer, usd: billedUsdInScope() ?? 0 };
      },
      view: (frames: readonly Frame[]) => withOrgContext(orgId, () => viewFrames({ ask: viewerAsk }, frames))
    };
    const out = await withOrgContext(orgId, () => critique(ports, { doc: session.doc, request: message, references: session.references ?? [] })).catch((e: unknown) => {
      console.warn('[motion-agent] critic failed, delivering without its review', e);
      return { review: null, usd: 0, sheet: null };
    });
    spent += out.usd;
    return out;
  };

  let settle: (outcome: TurnOutcome) => void = () => {};
  let abandon: (e: unknown) => void = () => {};
  const done = new Promise<TurnOutcome>((resolve, reject) => {
    settle = resolve;
    abandon = reject;
  });
  done.catch(() => {});

  const steps: TurnStep[] = [];
  const workingScope = { ...frameScope, bucket };
  let keeping: Promise<void> = Promise.resolve();
  let keptEdit = 0;
  const keepWork = () => {
    keeping = keeping.then(async () => {
      if (keptEdit === session.edits.length) {
        return;
      }
      keptEdit = session.edits.length;
      await keepWorkingDoc(workingScope, { edit: keptEdit, doc: session.doc });
    });
  };

  let landing: Promise<TurnOutcome> | null = null;
  const land = () => (landing ??= finishTurn(steps));
  const landEarly = () => {
    void land().then(settle, abandon);
    cut.abort();
  };
  const wall = setTimeout(landEarly, Math.max(0, timing.landingMs - (Date.now() - startedAt)));
  const watch = setInterval(() => {
    void reply.stopped().then((stopped) => {
      if (stopped) {
        landEarly();
      }
    });
  }, timing.stopPollMs);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      askPreview = (request) => writer.write({ type: FRAMES_REQUEST, data: request });
      askCheck = (request) => writer.write({ type: CHECK_REQUEST, data: request });
      announce = () => {
        if (session.edits.length === announced) {
          return;
        }
        announced = session.edits.length;
        writer.write({ type: DOC_EDITED, data: { edit: announced, doc: session.doc } });
        keepWork();
      };
      let conversation = openingMessages;

      let started = false;
      const play = async (messages: ModelMessage[], kind: Round, toolSet: typeof tools = tools, looks: Looks = roleLooks(ROUND_ROLE[kind] ?? role)) => {
        const first = !started;
        started = true;
        session.looks = looks;
        const answered: ModelMessage[] = [];
        const played = round(messages, kind, (step) => {
          steps.push(step);
          answered.push(...(step.response.messages as ModelMessage[]));
          void reply.progress(finishedTurn(steps));
        }, toolSet);
        writer.merge(played.toUIMessageStream({ sendStart: first, sendFinish: false, sendReasoning: true }));
        await Promise.resolve(played.steps).catch((e: unknown) => {
          console.error(`[motion-agent] ${kind} round failed, keeping the steps it finished`, e);
        });
        conversation = [...messages, ...answered];
        return answered;
      };

      const crewsFor = role === StudioRole.ShotBuilder && head.doc.script ? shotCrews(head.doc.script) : [];
      if (crewsFor.length > 1) {
        const base = openingMessages;
        const crewed = await Promise.all(crewsFor.map(async (crew) => {
          const asked: ModelMessage[] = [...base, { role: 'user', content: crewBrief(crew) }];
          return [asked.at(-1)!, ...(await play(asked, openingRound, ownLook(crewTools(tools, crew), roleLooks(role)) as typeof tools, Looks.Blind))];
        }));
        conversation = [...base, ...crewed.flat()];
      } else {
        await play(openingMessages, openingRound);
      }
      if (openingRound === Round.Research && !awaitsUser(steps)) {
        await play([...conversation, { role: 'user', content: RESEARCH_DONE }], Round.Edit);
      }
      if (role === StudioRole.ShotBuilder && !awaitsUser(steps) && session.edits.length) {
        await play([...conversation, { role: 'user', content: SOUND_PASS }], Round.Sound);
      }
      const awaitsGo = awaitsUser(steps);
      for (let attempt = 0; attempt < MAX_DELIVERY_ATTEMPTS && !(attempt > 0 && overBudget({ steps: [] })) && !awaitsGo && steps.length && deliveryBlocked(session, vision); attempt++) {
        const errors = openErrors(session);
        const times = keyFrameTimes(session.doc);
        await play([...conversation, checkMessage(errors, times)], Round.SelfCheck);
      }
      const critiqued = steps.length > 0 && !awaitsGo && REVIEWED.has(role) && !reviewedBefore(turns) && vision === Vision.Available && session.edits.length > 0 ? await reviewCut() : null;
      const fix = critiqued?.review ? criticMessage(critiqued.review) : null;
      if (fix && gate === CutGate.Auto) {
        await play([...conversation, fix], Round.SelfCheck);
      }
      if (fix && gate === CutGate.Ask && critiqued?.review) {
        const output = { ok: true, ...critiqued.review, sheet: await storeSheet(critiqued.sheet) };
        gateTools.push({ toolCallId: CUT_REVIEW_ID, toolName: REVIEW_CUT, status: 'done', input: {}, output });
        writer.write({ type: 'tool-input-available', toolCallId: CUT_REVIEW_ID, toolName: REVIEW_CUT, input: {} });
        writer.write({ type: 'tool-output-available', toolCallId: CUT_REVIEW_ID, output });
      }
      const held = awaitsGo || gateTools.length > 0;
      const unlooked = steps.length > 0 && !held && selfCheckDue(session, vision);
      if (unlooked) {
        conversation = [...conversation, ...(await lastLook(conversation))];
      }
      if (steps.length && !held && (unlooked || !closedByModel(steps.at(-1)))) {
        await play([...conversation, { role: 'user', content: SUMMARY_PROMPT }], Round.Summary);
      }
      const left = videoBudget(budget.spentUsd + charged(), raisedUsd);
      if (budgetSpent(left, reserve)) {
        budgetTools.push(budgetTool(budgetCard(left)));
        writeText(writer, BUDGET_ID, budgetNote(budgetCard(left)));
        writeCard(writer, budgetCard(left));
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
      settle(await land());
    },
    onError: (e) => {
      console.error('[motion-agent] turn failed', e);
      void reply
        .finish(finishedTurn(steps), ReplyStatus.Failed)
        .then(land)
        .finally(() => abandon(e));
      return 'The agent could not finish this turn.';
    }
  });

  async function saveAgentDoc() {
    const save = (expectedVersion: number) => saveMotionDoc(db, { orgId, nodeId: motion.record.id, expectedVersion, doc: session.doc, actor, summary: session.edits.join(', ') });
    let write = await save(session.baseVersion);
    for (let attempt = 1; attempt < SAVE_ATTEMPTS && write.outcome === RevisionOutcome.Conflict; attempt++) {
      const latest = await headOrNew(db, nodeScope, motion.node);
      write = await save(latest.version);
    }
    return write;
  }

  const roleLabel = STUDIO_ROSTER[role].label;
  const sideRole = openingRound === Round.Research ? StudioRole.Researcher : StudioRole.Sound;
  const labelOf = (modelId: string) => (modelId === roleModel(sideRole, model) && modelId !== model ? STUDIO_ROSTER[sideRole].label : modelId === model ? roleLabel : modelId === codeModel ? `${roleLabel}-code` : `${roleLabel}-vision`);

  async function finishTurn(steps: TurnStep[]): Promise<TurnOutcome> {
    clearTimeout(wall);
    clearInterval(watch);
    session.doc = fitNewVideo(head.doc, session.doc);
    session.doc = { ...session.doc, assets: referencedAssets(session.doc, assets.map((a) => ({ id: a.id, kind: a.kind, name: a.label }))) };
    const write = session.edits.length ? await saveAgentDoc() : null;
    if (write && write.outcome !== RevisionOutcome.Written) {
      console.warn('[motion-agent] revision not saved', { nodeId: motion.record.id, outcome: write.outcome });
    }
    if (write?.outcome === RevisionOutcome.Written) {
      await keeping;
      await dropWorkingDoc(workingScope);
    }

    const finished = finishedTurn(steps);
    const card = (budgetTools[0]?.output as BudgetCard | undefined) ?? null;
    const content = finalReply(steps.map((s) => s.text), awaitsUser(steps) ? [] : openErrors(session));
    const turn = { tools: [...finished.tools, ...gateTools, ...budgetTools], content: card ? `${content}\n\n${budgetNote(card)}` : content };
    await reply.finish(turn, ReplyStatus.Done);

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
    const asked = finished.tools.map(savedPick).findLast((p) => p !== null) ?? null;
    return { reply: turn.content, summary: written ? session.edits.join(', ') : null, version: written?.version ?? null, revision: write?.outcome ?? null, costUsd: charged(), pick: asked, cut: (gateTools[0]?.output as CutReview | undefined) ?? null, budget: card };
  }

  const reader = stream.getReader();
  const followed = new ReadableStream<UIMessageChunk>({
    pull: async (controller) => {
      const next = await reader.read();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(next.value);
    },
    cancel: (reason) => {
      client = Client.Gone;
      return reader.cancel(reason);
    }
  });
  return { stream: followed, done };
}
