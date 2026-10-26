import { SPAWN_AGENT } from '$lib/server/agents/spawn';
import { PLATFORM_TIMING, landingWatch } from '$lib/server/agents/turn-core';
import { spawnAgentTool, spawnAgents, spawnOffers } from '$lib/server/agents/spawn-agent';
import { createUIMessageStream, createUIMessageStreamResponse, streamText, type ModelMessage, type Tool } from 'ai';
import type { Db } from '$lib/server/db/client';
import { llmLanguageModel } from '$lib/server/llm';
import { PromptCache } from '$lib/server/prompt-cache';
import { reasoningProviderOptions } from '$lib/server/chat-model/catalogue';
import { extractSdkUsage, logAiCall, withBrandContext, withOrgContext } from '$lib/server/ai-log';
import { saveTurn, type PromptTurn, type Turn } from '$lib/server/repos/chat';
import { finishedTurn } from './finished-turn';
import { openReply, ReplyStatus } from '$lib/server/repos/chat-reply';
import { agentActor, SIDEBAR_AGENT_KEY } from '$lib/server/repos/actor';
import { createProjectTools } from './project-tools';
import { createMotionDelegation } from './motion-delegation';
import { editorFrames, frameRunner, type OpenFrame } from './frame-tools';
import { frameSurface, toolLoadingOf } from './tool-loading';
import { env } from '$env/dynamic/private';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { FRAMES_REQUEST, type FramesRequest } from '$lib/motion/frames-request';
import type { FrameBucket } from '$lib/server/motion/frame-store';
import { openAgentTools } from './tool-surface';
import { createWebTools } from '$lib/server/web/web-tools';
import { liveWebDeps, productImport, productsNodePlacer, webImageImport } from '$lib/server/web/live';
import { projectAgentPrompt, selectedNodes } from './system-prompt';
import { AGENT_TURN_CAP_USD, agentStopWhen, overTurnCap } from './limits';
import { spentUsd } from '$lib/server/motion/model-route';
import { ensureGatewayModels, gatewayRate } from '$lib/server/openrouter-models';
import { runInBackground } from '$lib/server/background-work';
import { canvasPlaceHint, userContent } from '$lib/server/chat-attachments/model-parts';
import { breakdownReader } from '$lib/server/video-reference';
import { ASK_REFERENCE_PICK, avoidedImages, choosesForUser, pickAwaits, rejectedRounds, shownRefs, type PickAnswer } from '$lib/reference-pick';
import type { ChatAttachment } from '$lib/chat-attachments';
import type { OpenProject } from '$lib/server/projects/lookup';

export type ProjectTurnInput = {
  db: Db;
  userId: string;
  accessToken: string;
  origin: string;
  orgId: string;
  project: OpenProject['project'];
  brand: BriefBrand | null;
  text: string;
  attachments: ChatAttachment[];
  model: string;
  reasoning: string | null;
  frame: OpenFrame | null;
  selection: unknown;
  canvases: { id: string; name: string }[];
  canvasId: string | null;
  threadId: string;
  turns: Turn[];
  history: PromptTurn[];
  pick: PickAnswer | null;
};

export type BriefBrand = { id: string; name: string; slug: string };

export async function startProjectTurn(input: ProjectTurnInput): Promise<Response> {
  const { db, userId, accessToken, origin, orgId, project, brand, text, attachments, model, reasoning, frame, selection, canvases, canvasId, threadId, turns, history, pick } = input;
  const actor = agentActor(userId, SIDEBAR_AGENT_KEY);
  const userActor = { kind: 'user' as const, id: userId };
  await saveTurn(db, { orgId, threadId, role: 'user', content: text, attachments, actor: userActor });
  const opening = await userContent(db, { orgId, text, attachments, hint: canvasPlaceHint(project.id), breakdown: breakdownReader(db, { orgId, projectId: project.id, mode: project.mode }) });
  const reply = await openReply(db, { orgId, threadId, actor });
  const steps: Parameters<typeof finishedTurn>[0][number][] = [];

  let spent = 0;
  let askEditor: (request: FramesRequest) => void = () => {};
  const webTools = createWebTools({
    ...liveWebDeps(db, { orgId, userId: userId, projectId: project.id, brandId: brand?.id ?? null, mode: project.mode }, (usd) => {
      spent += usd;
    }),
    importImage: webImageImport(db, { orgId, projectId: project.id, mode: project.mode }),
    importProducts: productImport(webImageImport(db, { orgId, projectId: project.id, mode: project.mode }), canvasId ? productsNodePlacer(db, { orgId, projectId: project.id, canvasId, actor }) : undefined),
    avoid: avoidedImages(pick),
      shown: shownRefs(turns),
      rejections: rejectedRounds([...turns, { role: 'user', content: text }])
  });
  if (choosesForUser(text)) {
    delete webTools[ASK_REFERENCE_PICK];
  }
  const core: Record<string, Tool> = {
    ...createProjectTools({ db, orgId, projectId: project.id, userId: userId, brandId: brand?.id ?? null }),
    ...createMotionDelegation({ db, orgId, projectId: project.id, userId: userId, origin, model, canvasId }),
    ...webTools
  };
  const frameDeps = { db, orgId, projectId: project.id, userId: userId, open: frame, editor: frame ? editorFrames(db, db.storage.from(CANVAS_ASSET_BUCKET) as unknown as FrameBucket, { orgId, projectId: project.id, nodeId: frame.nodeId, userId: userId }, (request) => askEditor(request)) : null };
  Object.assign(core, {
    [SPAWN_AGENT]: spawnAgentTool(
      spawnOffers(),
      spawnAgents(
        {
          orgId,
          tools: () => core,
          codeTools: new Set<string>(),
          visionTools: new Set(['view_images']),
          remainingUsd: () => AGENT_TURN_CAP_USD - spent,
          onSpent: (usd) => {
            spent += usd;
          },
          changes: () => 0,
          changedSince: () => [],
          log: (e) => logAiCall({ label: `project-spawned-${e.label}`, provider: 'llm', model: e.model, ms: 0, ok: true, brandId: brand?.id, orgId, userId: userId, threadId, projectId: project.id, actorKind: 'agent', actorId: userId, agentKey: e.agentKey, ...e.usage })
        },
        spawnOffers()
      )
    )
  });
  const frames = await frameSurface(toolLoadingOf(env.TOOL_LOADING), frameDeps, frameRunner(frameDeps), core, turns, { ...webTools, [SPAWN_AGENT]: core[SPAWN_AGENT] });
  const projectTools = { ...core, ...frames.tools };
  const agent = await openAgentTools({
    projectTools,
    brand,
    accessToken
  });

  await ensureGatewayModels();
  const t0 = Date.now();
  const cut = new AbortController();
  const watch = landingWatch({
    startedAt: t0,
    timing: PLATFORM_TIMING,
    stopped: () => reply.stopped(),
    landEarly: () => {
      watch.stop();
      void reply.finish(finishedTurn(steps), ReplyStatus.Done).then(() => cut.abort());
    }
  });
  const billedScope = <T>(fn: () => T): T => (brand ? withBrandContext(brand.id, fn) : withOrgContext(orgId, fn));

  const result = billedScope(() => streamText({
    model: llmLanguageModel(model, PromptCache.On),
    system: projectAgentPrompt({
      project: { id: project.id, name: project.name },
      canvases: canvases.map((c) => ({ id: c.id, name: c.name })),
      brand: brand ? { name: brand.name, slug: brand.slug } : null,
      openCanvasId: canvasId,
      frame,
      selectedNodeIds: selectedNodes(selection),
      frameGuidance: frames.guidance
    }),
    allowSystemInMessages: true,
    messages: [...history, { role: 'user', content: opening }] as ModelMessage[],
    tools: agent.tools,
    prepareStep: () => {
      const active = frames.active();
      return active ? { activeTools: [...active, ...Object.keys(agent.tools).filter((name) => !(name in projectTools))] } : {};
    },
    providerOptions: reasoningProviderOptions(reasoning),
    abortSignal: cut.signal,
    stopWhen: [agentStopWhen(t0), overTurnCap(() => spent), ({ steps }) => pickAwaits(steps)],
    onStepFinish: (step) => {
      spent += spentUsd([extractSdkUsage(step.usage)], [model], gatewayRate);
      steps.push(step);
      void reply.progress(finishedTurn(steps));
    },
    onFinish: async ({ steps: finished, totalUsage }) => {
      watch.stop();
      await agent.close().catch((e) => console.error('[project-agent] tools not closed:', e));

      await reply.finish(finishedTurn(finished), ReplyStatus.Done);

      logAiCall({
        label: 'project-agent',
        provider: 'llm',
        model,
        ms: Date.now() - t0,
        ok: true,
        brandId: brand?.id,
        orgId,
        userId: userId,
        threadId,
        projectId: project.id,
        actorKind: 'agent',
        actorId: userId,
        agentKey: SIDEBAR_AGENT_KEY,
        ...extractSdkUsage(totalUsage)
      });
    }
  }));

  runInBackground(
    async () => {
      await result.consumeStream({ onError: (e) => console.error('[project-agent] turn failed after client left', e) });
      watch.stop();
      await reply.finish(finishedTurn(steps), ReplyStatus.Failed);
    },
    'project-agent-turn'
  );

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      askEditor = (request) => writer.write({ type: FRAMES_REQUEST, data: request });
      writer.merge(result.toUIMessageStream({ sendReasoning: true }));
    }
  });
  return createUIMessageStreamResponse({ stream });
}
