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
