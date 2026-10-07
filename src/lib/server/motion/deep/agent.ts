import sharp from 'sharp';
import { generateText, stepCountIs, type ModelMessage, type StopCondition, type Tool, type ToolSet } from 'ai';
import type { Db } from '$lib/server/db/client';
import { llmLanguageModel } from '$lib/server/llm';
import { PromptCache } from '$lib/server/prompt-cache';
import { reasoningProviderOptions } from '$lib/server/chat-model/catalogue';
import { ensureGatewayModels, gatewayRate } from '$lib/server/openrouter-models';
import { billedUsdInScope, extractSdkUsage, logAiCall, withOrgContext } from '$lib/server/ai-log';
import { assetUrls, headOrNew, motionAssets, motionTokens, saveMotionDoc } from '$lib/server/motion/editor';
import { motionAgentPrompt } from '$lib/server/motion/motion-prompt';
import { selectionNote, type MotionSession } from '$lib/server/motion/motion-tools';
import { workspaceTools } from '$lib/server/motion/workspace';
import { agentActor } from '$lib/server/repos/actor';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { SIGNED_URL_TTL_S } from '$lib/server/repos/asset-storage';
import { analyzeSounds, storageAnalysis } from '$lib/server/motion/audio-analysis';
import { frameStats } from '$lib/server/motion/frame-stats';
import { spentUsd } from '$lib/server/motion/model-route';
import { Vision, VIEW_FRAMES, type Frame } from '$lib/server/motion/frames';
import { awaitTask, FarmTask, launchStills, readStills, TaskState } from '$lib/server/motion/farm-render';
import { farmJob } from '$lib/server/motion/render-run';
import { motionRenderFarm } from '$lib/server/motion/renderer';
import { localStills, machinePorts } from '$lib/server/motion/local-stills';
import { dev } from '$app/environment';
import { RENDER_CALL_LABEL, Resolution, sandboxCostUsd } from '$lib/motion/render-quote';
import { ExportFormat, Quality } from '$lib/motion/export-formats';
import { Quality as Defect, docProblems, frameProblems } from '$lib/motion/direction';
import { STYLES, styleOf } from '$lib/motion/style';
import { AssetKind } from '$lib/motion/components';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import type { MotionNode } from '$lib/canvas/motion-node';
import type { DeepPorts, DeepState } from './loop';
import { critiquePrompt, critiqueTimes, parseVerdict, sampleTimes, stillSpans } from './critic';
import { ASSET_TOOLS, BUILD_NOTE, DIRECTOR_TOOLS, assetsPrompt, buildPrompt, directorSystem, summaryPrompt } from './prompts';
import { DEEP_BUILD_STEPS, DEEP_RESERVE_MS, Runtime, StillsEngine, stillsEngine } from './limits';

export const DEEP_AGENT_KEY = 'motion-deep';
const DIRECTOR_STEPS = 10;
const ASSET_STEPS = 16;
const STILLS_WAIT = { timeoutMs: 8 * 60_000, pollMs: 4_000 };
const SIGNATURE_SIZE = { width: 32, height: 18 };
const SHORT_LINE = 240;
const UNSCALED = Resolution.P2160;

export enum Effort {
  High = 'high',
  Medium = 'medium',
  Low = 'low'
}

export type DeepContext = {
  db: Db;
  orgId: string;
  userId: string;
  threadId: string;
  project: { id: string; brandId: string | null };
  motion: { record: CanvasNodeRecord; node: MotionNode };
  model: string;
  brief: string;
  startedAt: number;
  maxMs: number;
  capUsd: number;
  spentBefore: number;
  assetsNote: string;
};

export type DeepHooks = {
  checkpoint: (state: DeepState, extra: { spentUsd: number; assets: string }) => Promise<void>;
  stopped: () => Promise<boolean>;
};

type Phase = 'direct' | 'assets' | 'build' | 'critique' | 'summary';

type Call = { system?: string; messages: ModelMessage[]; tools?: ToolSet; effort: Effort; steps: number; label: Phase; deadline?: number; afterStep?: () => Promise<unknown> };

const pick = (tools: Record<string, Tool>, names: string[]): ToolSet => Object.fromEntries(names.filter((n) => tools[n]).map((n) => [n, tools[n]]));

const short = (text: string) => (text.length > SHORT_LINE ? `${text.slice(0, SHORT_LINE)}…` : text).trim();

async function signature(bytes: Buffer): Promise<Uint8Array> {
  return new Uint8Array(await sharp(bytes).greyscale().resize(SIGNATURE_SIZE.width, SIGNATURE_SIZE.height, { fit: 'fill' }).raw().toBuffer());
}

export async function deepPorts(ctx: DeepContext, hooks: DeepHooks): Promise<DeepPorts> {
  const { db, orgId, userId, project, motion, model } = ctx;
  const actor = agentActor(userId, DEEP_AGENT_KEY);
  const nodeScope = { orgId, nodeId: motion.record.id };
  await ensureGatewayModels();

  const [head, tokens] = await Promise.all([headOrNew(db, nodeScope, motion.node), motionTokens(db, { orgId, brandId: project.brandId })]);
  const assets = await motionAssets({ db, orgId, projectId: project.id, canvasId: motion.record.canvasId });
  const session: MotionSession = { doc: head.doc, baseVersion: head.version, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = workspaceTools(
    { db, userId, orgId, project, record: motion.record, actor, agentKey: DEEP_AGENT_KEY },
    { head, tokens, assets, session, frames: async () => null, check: async () => null }
  );
  const buildTools = Object.fromEntries(Object.entries(tools).filter(([name]) => name !== VIEW_FRAMES)) as ToolSet;
  const style = STYLES[styleOf(session.doc)];
  const frame = { width: session.doc.width, height: session.doc.height };
  const buildSystem = [motionAgentPrompt({ brandName: project.brandId ? tokens.name : null, selectionNote: selectionNote(session.doc, []), vision: Vision.Missing, frame, style: styleOf(session.doc) }), BUILD_NOTE].join('\n');

  let spent = ctx.spentBefore;
  let assetsNote = ctx.assetsNote;
  const remainingMs = () => ctx.maxMs - (Date.now() - ctx.startedAt) - DEEP_RESERVE_MS;
  const rate = gatewayRate(model);

  const saved = { count: 0, lost: [] as string[] };

  const saveDoc = async (): Promise<void> => {
    if (!session.edits.length) {
      return;
    }
    const summary = session.edits.slice(0, 12).join(', ');
    const write = await saveMotionDoc(db, { orgId, nodeId: motion.record.id, expectedVersion: session.baseVersion, doc: session.doc, actor, summary });
    const count = session.edits.length;
    session.edits = [];
    if (write.outcome === RevisionOutcome.Written) {
      session.baseVersion = write.head.version;
      saved.count += count;
      return;
    }
    const fresh = await headOrNew(db, nodeScope, motion.node);
    session.doc = fresh.doc;
    session.baseVersion = fresh.version;
    saved.lost.push(`${count} edits refused (${write.outcome}${'error' in write ? `: ${write.error}` : ''})`);
  };

  const savedNote = () => {
    const note = `${saved.count} edits saved${saved.lost.length ? `; ${saved.lost.join('; ')}` : ''}`;
    saved.count = 0;
    saved.lost = [];
    return note;
  };

  const call = (input: Call) =>
    withOrgContext(orgId, async () => {
      const t0 = Date.now();
      const deadline = input.deadline ?? Number.POSITIVE_INFINITY;
      const stops: StopCondition<ToolSet>[] = [stepCountIs(input.steps), () => Date.now() >= deadline, () => spent > ctx.capUsd, () => hooks.stopped()];
      let estimate = 0;
      const result = await generateText({
        model: llmLanguageModel(model, PromptCache.On),
        system: input.system,
        messages: input.messages,
        tools: input.tools,
        stopWhen: stops,
        providerOptions: reasoningProviderOptions(input.effort),
        onStepFinish: async (step) => {
          const stepUsd = spentUsd([extractSdkUsage(step.usage)], [model], () => rate);
          estimate += stepUsd;
          spent += stepUsd;
          await input.afterStep?.();
        }
      });
      logAiCall({ label: DEEP_AGENT_KEY, context: input.label, provider: 'llm', model, ms: Date.now() - t0, ok: true, orgId, userId, threadId: ctx.threadId, projectId: project.id, actorKind: 'agent', actorId: userId, agentKey: DEEP_AGENT_KEY, ...extractSdkUsage(result.totalUsage) });
      const billed = billedUsdInScope();
      spent += (billed ?? estimate) - estimate;
      return result.text;
    });

  const stillsJob = async () => {
    const signed = await motionAssets({ db, orgId, projectId: project.id, canvasId: motion.record.canvasId }, SIGNED_URL_TTL_S.render);
    const soundIds = signed.filter((a) => a.kind === AssetKind.Audio).map((a) => a.id);
    const analyses = await analyzeSounds(storageAnalysis(db), { orgId, projectId: project.id }, signed, soundIds);
    return farmJob({ doc: session.doc, tokens, assets: assetUrls(signed), analyses }, { format: ExportFormat.Mp4H264, fps: session.doc.fps, quality: Quality.Standard, resolution: UNSCALED });
  };

  const farmFrames = async (): Promise<Frame[]> => {
    const farm = motionRenderFarm();
    if (!farm) {
      throw new Error('rendering is not configured here');
    }
    const times = sampleTimes(session.doc);
    const name = await launchStills(farm, await stillsJob(), times);
    const check = await awaitTask(farm, name, FarmTask.Stills, STILLS_WAIT);
    const frames = check.state === TaskState.Done ? await readStills(farm, name, times) : null;
    const usage = await farm.usage(name).catch(() => null);
    await (await farm.attach(name))?.stop().catch(() => {});
    const usd = usage ? sandboxCostUsd([usage]) : 0;
    spent += usd;
    logAiCall({ label: RENDER_CALL_LABEL, context: 'deep-stills', provider: 'vercel-sandbox', model: 'hyperframes-stills', flatCostUsd: usd, ms: usage?.wallMs ?? 0, ok: Boolean(frames), orgId, projectId: project.id, userId, actorKind: 'agent', actorId: userId });
    if (!frames) {
      throw new Error(check.error ?? 'the stills could not be read');
    }
    return frames;
  };

  const machineFrames = async (): Promise<Frame[]> => localStills(machinePorts)(await stillsJob(), sampleTimes(session.doc));

  const STILLS: Record<StillsEngine, () => Promise<Frame[]>> = { [StillsEngine.Farm]: farmFrames, [StillsEngine.Machine]: machineFrames };
  const renderFrames = STILLS[stillsEngine(dev ? Runtime.Dev : Runtime.Deployed)];

  const critique = async (input: { storyboard: string; frames: Frame[] }) => {
    const seconds = session.doc.durationInFrames / session.doc.fps;
    const shownTimes = critiqueTimes(session.doc, input.frames.map((f) => f.time));
    const shown = input.frames.filter((f) => shownTimes.includes(f.time));
    const signed = await Promise.all(input.frames.map(async (f) => ({ time: f.time, signature: await signature(f.bytes) })));
    const stills = stillSpans(signed, seconds).map((s) => `nothing moves from ${s.from}s to ${s.to}s: give the picture a slow push-in or pan, or cut sooner`);
    const audioAssets = assets.filter((a) => a.kind === AssetKind.Audio).length;
    const objective = [...docProblems(session.doc, { audioAssets }), ...frameProblems(await frameStats(shown)).filter((p) => p.kind !== Defect.WhiteArea)].map((p) => p.detail).concat(stills);
    const text = critiquePrompt({ storyboard: input.storyboard, times: shown.map((f) => f.time), objective, styleRules: style.rules });
    const content = [{ type: 'text' as const, text }, ...shown.map((f) => ({ type: 'file' as const, mediaType: 'image/jpeg', data: f.bytes }))];
    const answer = await call({ messages: [{ role: 'user', content }], effort: Effort.High, steps: 1, label: 'critique' });
    return parseVerdict(answer, objective);
  };

  return {
    direct: () =>
      call({
        system: directorSystem({ styleLabel: style.label, styleRules: style.rules, frame, seconds: session.doc.durationInFrames / session.doc.fps }),
        messages: [{ role: 'user', content: ctx.brief }],
        tools: pick(tools, DIRECTOR_TOOLS),
        effort: Effort.High,
        steps: DIRECTOR_STEPS,
        label: 'direct',
        deadline: Date.now() + remainingMs()
      }),
    prepare: async (storyboard) => {
      const text = await call({ system: buildSystem, messages: [{ role: 'user', content: assetsPrompt({ brief: ctx.brief, storyboard }) }], tools: pick(tools, ASSET_TOOLS), effort: Effort.Medium, steps: ASSET_STEPS, label: 'assets', deadline: Date.now() + remainingMs(), afterStep: saveDoc });
      assetsNote = text;
      return `${short(text)} (${savedNote()})`;
    },
    build: async (input) => {
      const text = await call({ system: buildSystem, messages: [{ role: 'user', content: buildPrompt({ brief: ctx.brief, storyboard: input.storyboard, assets: assetsNote, fixes: input.fixes, iteration: input.iteration }) }], tools: buildTools, effort: Effort.Medium, steps: DEEP_BUILD_STEPS, label: 'build', deadline: Date.now() + remainingMs(), afterStep: saveDoc });
      return `${short(text)} (${savedNote()})`;
    },
    render: renderFrames,
    critique,
    summarize: (state) => call({ messages: [{ role: 'user', content: summaryPrompt(state, ctx.brief) }], effort: Effort.Low, steps: 1, label: 'summary' }),
    checkpoint: async (state) => {
      await hooks.checkpoint(state, { spentUsd: spent, assets: assetsNote });
    },
    stopRequested: hooks.stopped,
    spentUsd: () => spent,
    remainingMs
  };
}
