import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { awaitRun, motionApi } from '../../lib/motion.ts';
import { requireAuth, withAuth, fail, type ToolResult } from '../util.ts';

const MAX_FRAMES = 6;
const MAX_FRAME_WIDTH = 960;

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
        'Find the node id with `list_motion_videos`; read the video first with `get_motion_summary` to name clips precisely. ' +
        'Returns at once with a `run_id` (`running`): poll `get_motion_run` every few seconds until `done`, which carries the ' +
        'reply, the summary and the new revision `version`. `wait: true` polls for you, up to about 4 minutes of a turn that can run up to 30. The agent looks at its own ' +
        'frames even with no editor open. Spends credits.',
      inputSchema: z.object({ org, node_id: z.string(), prompt: z.string().min(1), wait: z.boolean().optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id, prompt, wait }) =>
      withAuth(async (token) => {
        const run = await motionApi.ask(token, node_id, prompt, org);
        return wait === true ? awaitRun(token, run, { org }) : run;
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
        'to the project. Show the link to the user. `mode: "server"` is not available yet: it is refused with 403. ' +
        'A live component (a game or generative piece) cannot be seeked: the video shows a still of it; publish it as an embed instead. ' +
        'Poll `get_render` with the `run_id` for the file.',
      inputSchema: z.object({
        org,
        node_id: z.string(),
        mode: z.enum(['browser', 'server']).optional(),
        resolution: z.enum(['720p', '1080p', '1440p', '2160p']).optional(),
        format: z.string().optional().describe('server only: mp4-h264, mp4-h265, prores-422hq, prores-4444, webm-alpha, png-sequence, gif'),
        quality: z.enum(['standard', 'high']).optional(),
        fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(50), z.literal(60)]).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id, mode, resolution, format, quality, fps }) => withAuth((token) => motionApi.render(token, node_id, { mode, resolution, format, quality, fps }, org))
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

  server.registerTool(
    'list_motion_videos',
    {
      title: 'List motion videos',
      description:
        'The motion videos (`motion` canvas nodes) of the org, newest first, optionally of one project: `node_id`, `name`, ' +
        '`project_id`, `canvas_id`, `format`, saved revision `version` (0 = empty), signed `poster_url` and `last_render_url` ' +
        '(one hour, null when none) and `editor_url`. Use it to find the `node_id` the other motion tools take. Reads only.',
      inputSchema: z.object({ org, project_id: z.string().optional() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, project_id }) => withAuth((token) => motionApi.list(token, project_id, org))
  );

  server.registerTool(
    'publish_motion_embed',
    {
      title: 'Publish a motion video as a web embed',
      description:
        'Host the interactive web export of the saved revision on feega and return the public `url` and an iframe `snippet` to paste ' +
        'into any site (keeps pointer, tilt, scroll, key and tap input; live components such as games and generative pieces run live there). Publishing again updates the same embed in place, so the site needs no ' +
        'new paste. `action: "unpublish"` takes it down. Videos from an uncensored project are refused (403, `refusal`). Free.',
      inputSchema: z.object({ org, node_id: z.string(), action: z.enum(['publish', 'unpublish']).optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({ org, node_id, action }) => withAuth((token) => (action === 'unpublish' ? motionApi.unembed(token, node_id, org) : motionApi.embed(token, node_id, org)))
  );

  server.registerTool(
    'view_motion_frames',
    {
      title: 'See frames of a motion video',
      description:
        `Draw the saved revision of a motion video at up to ${MAX_FRAMES} exact times (seconds) and see them as JPEG images, ` +
        'with the quality gate the editor agent uses: `quality` lists every problem found (clipped or tiny text, flat or blank frames, ' +
        'flashes, missing music...), `blocking` the ones that must be fixed before delivery. `width` is the longest side in pixels ' +
        `(default and max ${MAX_FRAME_WIDTH}). Use it to check a video before and after \`ask_motion_agent\`. Free; about 10 calls a minute per workspace.`,
      inputSchema: z.object({ org, node_id: z.string(), times: z.array(z.number().min(0)).min(1).max(MAX_FRAMES), width: z.number().int().min(64).max(MAX_FRAME_WIDTH).optional() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, node_id, times, width }): Promise<ToolResult> => {
      const auth = await requireAuth();
      if (!auth.ok) return auth.result;
      try {
        const { frames, ...notes } = await motionApi.frames(auth.session.access_token, node_id, { times, width }, org);
        const shown = { ...notes, times: frames.map((f) => f.time) };
        return {
          content: [{ type: 'text', text: JSON.stringify(shown, null, 2) }, ...frames.map((f) => ({ type: 'image' as const, data: f.data, mimeType: f.mime }))],
          structuredContent: shown
        };
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    }
  );

  server.registerTool(
    'get_motion_embed',
    {
      title: 'Read a motion web embed',
      description:
        'Whether the web embed of a motion video is `published`, its public `url`, the iframe `snippet` and the saved `revision`. ' +
        'The self-contained HTML file (no hosting) is downloaded with `feega motion embed <node> --download <file>`, or GET ' +
        '`/api/v1/motion/{node_id}/embed/bundle`. Reads only.',
      inputSchema: z.object({ org, node_id: z.string() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, node_id }) => withAuth((token) => motionApi.embedState(token, node_id, org))
  );
}
