import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import { SIDEBAR_AGENT_KEY, agentActor } from '$lib/server/repos/actor';
import { DocMode } from '$lib/motion/still';
import { DESCRIBE_FRAMES, VIEW_FRAMES, docTexts, withFrames, type Frame } from '$lib/server/motion/frames';
import { serverFramesOpen } from '$lib/server/motion/chromium-frames';
import { ToolRun, motionToolList, motionToolSpec, runMotionTool, type EditorFrames } from '$lib/server/motion/tool-run';
import type { MotionSession } from '$lib/server/motion/motion-tools';
import { awaitFrames, framesPrefix, type FrameBucket } from '$lib/server/motion/frame-store';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import type { FramesRequest } from '$lib/motion/frames-request';

export const LIST_FRAME_TOOLS = 'list_frame_tools';
export const DESCRIBE_FRAME_TOOL = 'describe_frame_tool';
export const FRAME_TOOL = 'frame_tool';

export const FRAME_TOOLS = [LIST_FRAME_TOOLS, DESCRIBE_FRAME_TOOL, FRAME_TOOL] as const;

export const PLAYER_TOOLS: ReadonlySet<string> = new Set([VIEW_FRAMES, DESCRIBE_FRAMES]);

export type OpenFrame = { nodeId: string; selection: string[]; playhead: number; mode: DocMode };

export const openFrameSchema = z.object({
  nodeId: z.string().min(1),
  selection: z.array(z.string()).max(50).default([]),
  playhead: z.number().min(0).default(0),
  mode: z.enum(DocMode).default(DocMode.Video)
});

export type FrameToolDeps = { db: Db; orgId: string; projectId: string; userId: string; open: OpenFrame | null; editor: EditorFrames | null; serverDraws?: () => boolean };

const NO_FRAME = { error: 'no_frame', message: 'No frame is open in the editor: pass node_id (list_motion_videos or list_nodes give it).' };

const NEEDS_EDITOR = { error: 'needs_open_editor', message: 'This tool looks at the rendered frame, which needs the frame open in the editor. Ask the user to open it, then retry.' };

const REFUSALS: Record<Exclude<ToolRun, ToolRun.Done>, string> = {
  [ToolRun.NotFound]: 'No frame with that id in this project.',
  [ToolRun.Unknown]: `No frame tool with that name: ${LIST_FRAME_TOOLS} lists them.`,
  [ToolRun.Invalid]: `The input does not match the tool: ${DESCRIBE_FRAME_TOOL} gives its schema.`,
  [ToolRun.Blocked]: 'Refused by the safety review.',
  [ToolRun.Conflict]: 'The frame changed while writing: retry.'
};

export type FramePlace = { orgId: string; projectId: string; nodeId: string; userId: string };

export function editorFrames(db: Db, bucket: FrameBucket, place: FramePlace, ask: (request: FramesRequest) => void): EditorFrames {
  const scope = { ...place, actor: agentActor(place.userId, SIDEBAR_AGENT_KEY) };
  return async (callId, times, doc) => {
    const review = await screenModelInput(db, { profile: ModerationProfile.Standard, texts: docTexts(doc), scope });
    if (!review.ok) {
      throw new Error(`frames withheld by the safety review: ${review.error}`);
    }
    ask({ callId, times, doc });
    return awaitFrames(bucket, framesPrefix(place, callId), times.length);
  };
}

export function createFrameTools(deps: FrameToolDeps): Record<string, Tool> {
  const sessions = new Map<string, MotionSession>();
  const seen = new Map<string, Frame[]>();
  const serverDraws = deps.serverDraws ?? serverFramesOpen;
  const drawable = (nodeId: string) => deps.open?.nodeId === nodeId || serverDraws();

  const run = tool({
    description: [
      'Run one frame (motion video or still) tool on a frame of THIS project: the same tools the frame editor has, saved as a new revision the user can undo.',
      `node_id defaults to the frame open in the editor. ${LIST_FRAME_TOOLS} names them, ${DESCRIBE_FRAME_TOOL} gives one input schema: read it before the first call to a tool.`,
      `${VIEW_FRAMES} returns the rendered frames as images.`
    ].join(' '),
    inputSchema: z.object({ node_id: z.string().optional(), tool: z.string().min(1), input: z.record(z.string(), z.unknown()).default({}) }).strict(),
    execute: async (input: { node_id?: string; tool: string; input: Record<string, unknown> }, { toolCallId }) => {
      const nodeId = input.node_id ?? deps.open?.nodeId;
      if (!nodeId) {
        return NO_FRAME;
      }
      if (PLAYER_TOOLS.has(input.tool) && !drawable(nodeId)) {
        return NEEDS_EDITOR;
      }

      const open = deps.open?.nodeId === nodeId ? deps.open : null;
      const turn = { sessions, selection: open?.selection ?? [], editor: open ? deps.editor : null };
      const ran = await runMotionTool(deps.db, { orgId: deps.orgId, userId: deps.userId, nodeId, projectId: deps.projectId, agentKey: SIDEBAR_AGENT_KEY }, { tool: input.tool, input: input.input, callId: toolCallId }, turn);
      if (ran.outcome !== ToolRun.Done) {
        return { error: ran.outcome, message: REFUSALS[ran.outcome], detail: ran.detail };
      }
      seen.set(toolCallId, ran.frames);
      return { node_id: nodeId, version: ran.version, saved: ran.saved, output: ran.output };
    }
  });

  return {
    [LIST_FRAME_TOOLS]: tool({
      description: 'Every tool of the frame editor, by name with one line of what it does. Free.',
      inputSchema: z.object({}).strict(),
      execute: async () => ({ tools: motionToolList() })
    }),

    [DESCRIBE_FRAME_TOOL]: tool({
      description: `One frame tool in full: description and JSON input schema, for ${FRAME_TOOL}. Free.`,
      inputSchema: z.object({ tool: z.string().min(1) }).strict(),
      execute: async (input: { tool: string }) => (await motionToolSpec(input.tool)) ?? { error: ToolRun.Unknown, message: REFUSALS[ToolRun.Unknown] }
    }),

    ...withFrames({ [FRAME_TOOL]: run }, { frames: seen })
  };
}
