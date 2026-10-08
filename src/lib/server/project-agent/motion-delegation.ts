import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import { listProjectAssets, type Asset } from '$lib/server/repos/assets';
import { agentActor, SIDEBAR_AGENT_KEY } from '$lib/server/repos/actor';
import { MOTION_FORMATS, type MotionFormat } from '$lib/motion/doc';
import { motionEditorPath } from '$lib/canvas/motion-node';
import { Preset, settingsOf } from '$lib/motion/export-formats';
import { findMotionNode } from '$lib/server/motion/editor';
import { listMotionVideos } from '$lib/server/motion/agent-videos';
import { askMotion, askStatus } from '$lib/server/motion/ask';
import { MOTION_START_DEPS, startMotion } from '$lib/server/motion/start';
import { RenderMode, renderState, requestRender } from '$lib/server/motion/agent-render';
import { motionFrames } from '$lib/server/motion/agent-frames';
import { MAX_FRAMES_PER_VIEW } from '$lib/server/motion/frames';
import { motionEmbedState, publishMotionEmbed, type EmbedAnswer } from '$lib/server/motion/agent-embed';

export const MOTION_DELEGATION_TOOLS = [
  'list_motion_videos',
  'create_motion_video',
  'ask_motion_agent',
  'get_motion_run',
  'view_motion_frames',
  'render_motion_video',
  'get_motion_render',
  'publish_motion_embed',
  'get_motion_embed'
] as const;

export type MotionDelegationDeps = { db: Db; orgId: string; projectId: string; userId: string; origin: string; model?: string; pollMs?: number };

const POLL_MS = 2000;
const MAX_WAIT_S = 90;
const DEFAULT_WAIT_S = 60;
const RUNNING = 'running';
const NOT_FOUND = { error: 'motion_node_not_found', message: 'No motion video with that id in this project.' };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const bodyOf = async (answer: Record<string, unknown> | Response): Promise<Record<string, unknown>> => (answer instanceof Response ? answer.json() : answer);

const embedBody = (answer: EmbedAnswer) => answer.body;

function mediaOf(assets: Asset[], ref: string): Asset | null {
  const direct = assets.find((a) => a.id === ref);
  const produced = assets.filter((a) => a.sourceNodeId === ref).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return direct ?? produced[0] ?? null;
}

type DrawnFrame = { time: number; mime: string; data: string };

function framesForModel(output: Record<string, unknown>) {
  const { frames, ...rest } = output as { frames?: DrawnFrame[] };
  if (!frames) {
    return { type: 'json' as const, value: rest as never };
  }
  return {
    type: 'content' as const,
    value: [
      { type: 'text' as const, text: JSON.stringify({ ...rest, times: frames.map((f) => f.time) }) },
      ...frames.map((f) => ({ type: 'file' as const, mediaType: f.mime, data: { type: 'data' as const, data: f.data } }))
    ]
  };
}

const mediaLine = (media: Asset[]) => `Media from the canvas to use (asset ids in list_assets): ${media.map((a) => `${a.id} (${a.type})`).join(', ')}.`;

export function createMotionDelegation(deps: MotionDelegationDeps): Record<string, Tool> {
  const { db, orgId, projectId, userId } = deps;
  const actor = agentActor(userId, SIDEBAR_AGENT_KEY);
  const pollMs = deps.pollMs ?? POLL_MS;

  const inProject = (nodeId: string) => findMotionNode(db, { orgId, nodeId, place: { projectId } });

  async function ask(nodeId: string, request: string, refs: string[] = []): Promise<Record<string, unknown>> {
    const motion = await inProject(nodeId);
    if (!motion) {
      return NOT_FOUND;
    }

    const assets = refs.length ? await listProjectAssets(db, { orgId, projectId }) : [];
    const media = refs.map((ref) => mediaOf(assets, ref));
    const missing = refs.filter((_, i) => !media[i]);
    if (missing.length) {
      return { error: 'media_not_found', message: `No image, video or audio produced by: ${missing.join(', ')}.` };
    }

    const prompt = media.length ? `${request}\n\n${mediaLine(media as Asset[])}` : request;
    const asked = await askMotion(db, { orgId, userId, nodeId, prompt, agentKey: SIDEBAR_AGENT_KEY, choice: { model: deps.model } });
    if (asked instanceof Response) {
      return asked.json();
    }
    return { run_id: asked.runId, node_id: nodeId, status: RUNNING, editor_url: motionEditorPath({ projectId, canvasId: motion.record.canvasId, nodeId }) };
  }

  async function settled(runId: string, waitS: number): Promise<Record<string, unknown>> {
    const deadline = Date.now() + Math.min(waitS, MAX_WAIT_S) * 1000;
    let state = await bodyOf(await askStatus(db, { orgId, runId }));
    while (state.status === RUNNING && Date.now() < deadline) {
      await pause(pollMs);
      state = await bodyOf(await askStatus(db, { orgId, runId }));
    }
    return state;
  }

  return {
    list_motion_videos: tool({
      description: 'List the motion videos of THIS project: node id, name, format, revision, poster and editor_url. Free.',
      inputSchema: z.object({}).strict(),
      execute: async () => ({ videos: await listMotionVideos(db, { orgId, projectId }) })
    }),

    create_motion_video: tool({
      description: [
        'Create a new motion video node on a canvas of THIS project (default canvas: the "Motion" canvas), placed to the right of the nodes listed in near.',
        'With a brief, the motion agent starts building it right away (costs credits, only when the user asked): poll get_motion_run with the returned run_id.',
        'media: node or asset ids whose image, video or audio the motion agent should use.'
      ].join(' '),
      inputSchema: z
        .object({
          name: z.string().min(1).max(80),
          canvasId: z.string().optional(),
          format: z.enum(MOTION_FORMATS).optional(),
          near: z.array(z.string()).optional().describe('Node ids the video is about: it is placed beside them.'),
          brief: z.string().max(8000).optional(),
          media: z.array(z.string()).optional()
        })
        .strict(),
      execute: async (input: { name: string; canvasId?: string; format?: MotionFormat; near?: string[]; brief?: string; media?: string[] }) => {
        const started = await startMotion(db, MOTION_START_DEPS, { orgId, projectId, canvasId: input.canvasId ?? null, userId, name: input.name, format: input.format, near: input.near, actor });
        if (!started) {
          return { error: 'canvas_not_found', message: 'No canvas with that id in this project.' };
        }
        const created = { node_id: started.nodeId, canvas_id: started.canvasId, editor_url: motionEditorPath(started) };
        return input.brief ? { ...created, ...(await ask(started.nodeId, input.brief, input.media)) } : created;
      }
    }),

    ask_motion_agent: tool({
      description: [
        'Hand a request to the motion editor agent for one motion video of THIS project: it writes the video itself, in the editor thread, and costs credits like the editor — only when the user asked.',
        'Runs in the background: poll get_motion_run with the returned run_id. media: node or asset ids of the canvas whose image, video or audio it should use.'
      ].join(' '),
      inputSchema: z.object({ nodeId: z.string(), request: z.string().min(1).max(8000), media: z.array(z.string()).optional() }).strict(),
      execute: async (input: { nodeId: string; request: string; media?: string[] }) => ask(input.nodeId, input.request, input.media)
    }),

    get_motion_run: tool({
      description: `State of a motion agent run: waits up to waitSeconds (default ${DEFAULT_WAIT_S}, max ${MAX_WAIT_S}) for it to finish. Done: reply and summary say what changed — tell the user, with the editor_url link. Still running: say so and that the video keeps building; poll again if the user waits.`,
      inputSchema: z.object({ runId: z.string(), waitSeconds: z.number().min(0).max(MAX_WAIT_S).optional() }).strict(),
      execute: async (input: { runId: string; waitSeconds?: number }) => settled(input.runId, input.waitSeconds ?? DEFAULT_WAIT_S)
    }),

    view_motion_frames: tool({
      description: `Look at a saved motion video of THIS project: up to ${MAX_FRAMES_PER_VIEW} frames at the given seconds, drawn on the server, with the quality gate (quality, blocking). Free. Use it to check what the motion agent built before telling the user.`,
      inputSchema: z.object({ nodeId: z.string(), times: z.array(z.number().min(0)).min(1).max(MAX_FRAMES_PER_VIEW) }).strict(),
      execute: async (input: { nodeId: string; times: number[] }) => {
        if (!(await inProject(input.nodeId))) {
          return NOT_FOUND;
        }
        const drawn = await motionFrames(db, { orgId, nodeId: input.nodeId }, { times: input.times });
        return drawn.ok ? drawn.body : { error: drawn.failure, detail: drawn.detail };
      },
      toModelOutput: ({ output }) => framesForModel(output)
    }),

    render_motion_video: tool({
      description: 'Export a motion video of THIS project to MP4 1080p. Returns a render_url the user opens to render it in their browser, and its credits. Only when the user asked.',
      inputSchema: z.object({ nodeId: z.string() }).strict(),
      execute: async (input: { nodeId: string }) => {
        if (!(await inProject(input.nodeId))) {
          return NOT_FOUND;
        }
        const asked = await requestRender(db, { orgId, userId, nodeId: input.nodeId, mode: RenderMode.Browser, settings: settingsOf(Preset.Social), origin: deps.origin, actor });
        return asked.ok ? asked.body : { error: asked.error, detail: asked.detail };
      }
    }),

    get_motion_render: tool({
      description: 'State of a render started with render_motion_video: status, progress and file_url once done.',
      inputSchema: z.object({ runId: z.string() }).strict(),
      execute: async (input: { runId: string }) => {
        const state = await renderState(db, { orgId, runId: input.runId });
        return state.ok ? state.body : { error: state.error };
      }
    }),

    publish_motion_embed: tool({
      description: 'Publish a motion video of THIS project as an embeddable interactive page: returns its public url and an iframe snippet. Only when the user asked. Refused for content the moderation refuses.',
      inputSchema: z.object({ nodeId: z.string() }).strict(),
      execute: async (input: { nodeId: string }) => ((await inProject(input.nodeId)) ? embedBody(await publishMotionEmbed(db, { orgId, nodeId: input.nodeId }, deps.origin)) : NOT_FOUND)
    }),

    get_motion_embed: tool({
      description: 'Whether a motion video of THIS project is published as an embed, with its url and snippet. Free.',
      inputSchema: z.object({ nodeId: z.string() }).strict(),
      execute: async (input: { nodeId: string }) => ((await inProject(input.nodeId)) ? embedBody(await motionEmbedState(db, { orgId, nodeId: input.nodeId }, deps.origin)) : NOT_FOUND)
    })
  };
}
