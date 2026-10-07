import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { awaitRun, motionApi } from '../../lib/motion.ts';
import { withAuth } from '../util.ts';

const org = z.string().optional().describe('Which org, if you belong to more than one.');

export function registerMotionTools(server: McpServer) {
  server.registerTool(
    'ask_motion_agent',
    {
      title: 'Ask the motion editor agent',
      description:
        'Edit a motion video (a `motion` canvas node) by asking the motion editor\'s own AI in plain words, ' +
        'e.g. "make the title red and add a bounce". It runs one turn of the same agent as the editor chat, ' +
        'with its own tools, writes a new revision of the video and posts the exchange in the editor chat. ' +
        'Read the video first with `get_motion_summary` to name clips precisely. ' +
        'With `wait` (default true) it returns when the turn ends, up to about 4 minutes; otherwise, or past ' +
        'that, it returns a `run_id` still `running` — poll `get_motion_run`. Frames cannot be inspected ' +
        'without the editor open in a browser. Spends credits.',
      inputSchema: z.object({ org, node_id: z.string(), prompt: z.string().min(1), wait: z.boolean().optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id, prompt, wait }) =>
      withAuth(async (token) => {
        const run = await motionApi.ask(token, node_id, prompt, org);
        return wait === false ? run : awaitRun(token, run, { org });
      })
  );

  server.registerTool(
    'get_motion_run',
    {
      title: 'Read a motion agent run',
      description:
        'State of an `ask_motion_agent` run: `status` (running, done, failed, expired), the agent `reply`, ' +
        'the `summary` of its edits, the new revision `version` (null when nothing was saved), `cost_usd` and `editor_url`. Reads only.',
      inputSchema: z.object({ org, run_id: z.string() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, run_id }) => withAuth((token) => motionApi.run(token, run_id, org))
  );

  server.registerTool(
    'render_video',
    {
      title: 'Render a motion video',
      description:
        'Render the saved revision of a motion video to MP4. Default `mode: "browser"`: free, returns a `render_url` — a one-time link ' +
        '(expires in 30 minutes, bound to this revision) the user opens on any device; it renders in their browser and saves the file ' +
        'to the project. Show the link to the user. `mode: "server"` renders on our machines instead: spends credits, use it only when ' +
        'the user cannot open a browser or needs ProRes, HEVC, WebM, GIF, PNG or 4K. Poll `get_render` with the `run_id` for the file.',
      inputSchema: z.object({
        org,
        node_id: z.string(),
        mode: z.enum(['browser', 'server']).optional(),
        resolution: z.enum(['720p', '1080p', '1440p', '2160p']).optional(),
        format: z.string().optional().describe('server only: mp4-h264, mp4-h265, prores-422hq, prores-4444, webm-alpha, png-sequence, gif')
      }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id, mode, resolution, format }) => withAuth((token) => motionApi.render(token, node_id, { mode, resolution, format }, org))
  );

  server.registerTool(
    'get_render',
    {
      title: 'Read a render',
      description: 'State of a `render_video` run: `status` (running, done, failed, expired), `mode`, and when done `asset_id` and a signed `file_url` valid one hour. Reads only.',
      inputSchema: z.object({ org, run_id: z.string() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, run_id }) => withAuth((token) => motionApi.renderState(token, run_id, org))
  );

  server.registerTool(
    'get_motion_summary',
    {
      title: 'Read a motion video',
      description:
        'The saved state of a motion video: revision `version`, last change and who made it, size, fps, ' +
        'duration and every track and clip with start/duration in seconds. Reads only, spends nothing.',
      inputSchema: z.object({ org, node_id: z.string() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, node_id }) => withAuth((token) => motionApi.summary(token, node_id, org))
  );
}
