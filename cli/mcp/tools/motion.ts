import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { awaitRun, motionApi } from '../../lib/motion.ts';
import { requireAuth, withAuth, fail, type ToolResult } from '../util.ts';
import { MAX_ATTACHMENTS } from '../../lib/attachments.ts';

const MAX_FRAMES = 6;
const MAX_FRAME_WIDTH = 960;

const EDITOR_READS = 'editor_session {briefIds?} (everything the editor page loads: head, assets, tokens, templates, render state, gallery), read_head {} (version, full doc, actorKind), render_status {} (latest server render), batch_status {} (latest batch render), list_fonts {} (the org's uploaded font families with their files)';
const EDITOR_WRITES =
  'save_doc {version,doc,summary?} (whole doc; 409 answers the head), apply_ops {version,ops,summary?} (doc ops, rebased on newer edits), ' +
  'record_export {path,width,height,seconds} (an mp4 already in storage becomes the render asset), upload_font {path} (a TTF/OTF/WOFF/WOFF2 already under <orgId>/fonts/ in canvas-assets; joins the org library), rename_font {family,to}, delete_font {family}, analyze_sounds {assetIds} (tempo, beats, speech), ' +
  'template_sounds {doc,clipId} (lays the template clip SFX; answers the doc), save_template {doc,name,description,compId?,posterFrame?}. ' +
  'Spends credits: generate_sound {sound:voice|music,text,seconds?} (answers assetId, url), render_batch {version,rows:[{name,values}],settings?} (one server render per row of template field values; poll batch_status)';

const org = z.string().optional().describe('Which org, if you belong to more than one.');

const attachment = z.union([
  z.object({ url: z.string().url(), name: z.string().optional() }),
  z.object({ asset_id: z.string() }),
  z.object({ data: z.string().describe('base64, up to about 4 MB'), name: z.string(), mime_type: z.string() })
]);

export function registerMotionTools(server: McpServer) {
  server.registerTool(
    'ask_motion_agent',
    {
      title: 'Ask the frame editor agent',
      description:
        'Edit a motion video (a `motion` canvas node) by asking the motion editor\'s own AI in plain words, ' +
        'e.g. "make the title red and add a bounce". It runs one turn of the same agent as the editor chat, ' +
        'with its own tools, writes a new revision of the video and posts the exchange in the editor chat. ' +
        'Find the node id with `list_motion_videos`; read the video first with `get_motion_summary` to name clips precisely. ' +
        'Returns at once with a `run_id` (`running`): poll `get_motion_run` every few seconds until `done`, which carries the ' +
        'reply, the summary and the new revision `version`. `wait: true` polls for you, up to about 4 minutes of a turn that can run up to 30. The agent looks at its own ' +
        'frames even with no editor open. Spends credits. ' +
        `\`attachments\` (up to ${MAX_ATTACHMENTS}): images (PNG, JPG, WebP, GIF) the agent sees and can place in the video, and PDF/DOCX/PPTX/XLSX/CSV/TXT/MD/HTML files it reads as text — ` +
        'each one a public `url`, an `asset_id` of the project, or inline base64 `data` with `name` and `mime_type`; at most 20 MB each. ' +
        'When the agent wants the user\'s taste it ends its turn with `reference_pick` in the run (question and candidate pictures with ids): ' +
        'show them to the user, then call again with `reference_pick: { follow: [ids], avoid: [ids], note }` (prompt optional), or `{ follow: [], avoid: [], rejected: true, query, avoid_all }` when none fit: the agent searches again. Followed pictures become the targets, avoided ones what not to do.',
      inputSchema: z.object({
        org,
        node_id: z.string(),
        prompt: z.string().optional(),
        wait: z.boolean().optional(),
        attachments: z.array(attachment).max(MAX_ATTACHMENTS).optional(),
        reference_pick: z.object({ follow: z.array(z.string()), avoid: z.array(z.string()), note: z.string().optional(), rejected: z.boolean().optional(), query: z.string().optional(), avoid_all: z.boolean().optional() }).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id, prompt, wait, attachments, reference_pick }) =>
      withAuth(async (token) => {
        const run = await motionApi.ask(token, node_id, prompt ?? '', org, attachments, reference_pick);
        return wait === true ? awaitRun(token, run, { org }) : run;
      })
  );

  server.registerTool(
    'list_shader_effects',
    {
      title: 'List shader effects',
      description:
        'The GPU shader effects (open-source shaders library, WebGPU) the motion agent adds with `add_shader_effect`: gradients, noise, glass, metal, light, distortions, wipes, blurs. ' +
        'Each with category, `source` (generator, or filter over a picture), `live` (cursor effects: interactive embeds only), its knobs with ranges and whether they take keyframes, and colours. ' +
        'Name one in `ask_motion_agent`, e.g. "add an iris-wipe reveal on the product shot". Reads only.',
      inputSchema: z.object({ org }),
      annotations: { readOnlyHint: true }
    },
    async ({ org }) => withAuth((token) => motionApi.shaderEffects(token, org))
  );

  server.registerTool(
    'get_motion_run',
    {
      title: 'Read a frame agent run',
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
      title: 'Render a frame',
      description:
        'Render the saved revision of a motion video to MP4. Default `mode: "browser"`: free, returns a `render_url` — a one-time link ' +
        '(expires in 30 minutes, bound to this revision) the user opens on any device; it renders in their browser and saves the file ' +
        'to the project. Show the link to the user. `mode: "server"` renders on the farm, the same path and credit gate as the editor Render button; while server rendering is closed for everyone it answers 403 `server_render_unavailable`. ' +
        'A live component (a game or generative piece) cannot be seeked: the video shows a still of it; publish it as an embed instead. ' +
        'Poll `get_render` with the `run_id` for the file.',
      inputSchema: z.object({
        org,
        node_id: z.string(),
        mode: z.enum(['browser', 'server']).optional(),
        resolution: z.enum(['720p', '1080p', '1440p', '2160p']).optional(),
        format: z.string().optional().describe('server only: mp4-h264, mp4-h265, prores-422hq, prores-4444, webm-alpha, png-sequence, gif'),
        quality: z.enum(['standard', 'high', 'max']).optional(),
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
    'get_storyboard',
    {
      title: 'Read the storyboard of a frame',
      description:
        'The storyboard canvas linked to a motion video: its cards left to right (`node_id`, `text`, the `clip_ids` that play it), ' +
        'the pictures and clips on it with their asset ids and the card each feeds, and the card-to-card `flow`. `storyboard: null` when none was written. Reads only.',
      inputSchema: z.object({ org, node_id: z.string() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, node_id }) => withAuth((token) => motionApi.storyboard(token, node_id, org))
  );

  server.registerTool(
    'write_storyboard',
    {
      title: 'Write the storyboard of a frame',
      description:
        'Lay out a motion video as a storyboard canvas: one card per beat, story order left to right, stronger emotion higher. ' +
        'Each beat: `act` (problem, solution, proof, claim), `kind` (title_card, ui_beat, product_shot, scene, logo), `title`, `intent`, `on_screen`, ' +
        '`emotion`, `intensity` 0-1, `duration` seconds, `visual`, `music`, `media` (project image/video asset ids), `branch_of` (index of an earlier beat it replaces). ' +
        'Replaces the cards written before; what the user added stays.',
      inputSchema: z.object({ org, node_id: z.string(), beats: z.array(z.record(z.string(), z.unknown())).min(1).max(40) }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id, beats }) => withAuth((token) => motionApi.writeStoryboard(token, node_id, { beats }, org))
  );

  server.registerTool(
    'edit_storyboard_card',
    {
      title: 'Rewrite a storyboard card',
      description: 'Replace the text of one card of a motion video storyboard (`card_id` from `get_storyboard`).',
      inputSchema: z.object({ org, node_id: z.string(), card_id: z.string(), text: z.string().min(1).max(4000) }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id, card_id, text }) => withAuth((token) => motionApi.editStoryboard(token, node_id, card_id, text, org))
  );

  server.registerTool(
    'get_motion_summary',
    {
      title: 'Read a frame',
      description:
        'The saved state of a motion video: revision `version`, last change and who made it, size, fps, ' +
        'duration and every track and clip with start/duration in seconds. Reads only, spends nothing.',
      inputSchema: z.object({ org, node_id: z.string() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, node_id }) => withAuth((token) => motionApi.summary(token, node_id, org))
  );

  server.registerTool(
    'list_motion_revisions',
    {
      title: 'List the saved versions of a frame',
      description:
        'Every saved revision of a motion video, newest first: `version`, who saved it (`actorKind` user or agent), the `summary` ' +
        'of the change and how many `clips` it had, so a broken or emptied version can be told from a good one. Reads only.',
      inputSchema: z.object({ org, node_id: z.string() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, node_id }) => withAuth((token) => motionApi.revisions(token, node_id, org))
  );

  server.registerTool(
    'restore_motion_revision',
    {
      title: 'Restore a saved version of a frame',
      description:
        'Put an earlier revision of a motion video back (number from `list_motion_revisions`). It is saved as a NEW revision: ' +
        'no history is deleted, and restoring again undoes it. Free.',
      inputSchema: z.object({ org, node_id: z.string(), version: z.number().int().positive() }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id, version }) => withAuth((token) => motionApi.restore(token, node_id, version, org))
  );

  server.registerTool(
    'list_motion_templates',
    {
      title: 'List frame templates',
      description:
        'Ready-made pieces to drop into a motion video (built-in and saved by the org), e.g. builtin:prompt-input, a prompt field that types, presses send and thinks. ' +
        'Each with `id`, `seconds`, its `card` (roles such as opener/feature/proof/closer, energy, loops, onScreen beat by beat with seconds, edges start→end with a suggested transition, goodFor) and its `fields`: key, type (text, number min..max, color #rrggbb, boolean, select options), group and default. Plan a video as sections and pick one template per section by card. Reads only, free.',
      inputSchema: z.object({ org }),
      annotations: { readOnlyHint: true }
    },
    async ({ org }) => withAuth((token) => motionApi.templates(token, org))
  );

  server.registerTool(
    'new_motion_from_template',
    {
      title: 'Start a frame from a template',
      description:
        'Create a new motion video that already holds a template (id from `list_motion_templates`) at 0s, sized to `format` (16:9 default; 9:16 story, 4:5 post, "A poster"), ' +
        'in `project` (default: the most recently active). `still`: seconds of the one frame to keep, making it a still graphic (post, poster) instead of a video. Returns node_id and editor_url; change its fields with `add_motion_template` vars or `ask_motion_agent`. No AI, free.',
      inputSchema: z.object({ org, template: z.string(), format: z.enum(['16:9', '9:16', '1:1', '4:5', '1:1 1440', 'A poster']).optional(), project: z.string().optional(), still: z.number().min(0).optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, ...body }) => withAuth((token) => motionApi.fromTemplate(token, body, org))
  );

  server.registerTool(
    'add_motion_template',
    {
      title: 'Add a template to a frame',
      description:
        'Insert an editable copy of a template (id from `list_motion_templates`) at `at` seconds, its fields set from `vars` (keys and types as listed). ' +
        '`sound` (default true) lays its key taps and clicks on the SFX track. Saved as a new revision; no AI, free.',
      inputSchema: z.object({ org, node_id: z.string(), id: z.string(), at: z.number().min(0).optional(), vars: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(), sound: z.boolean().optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id, ...body }) => withAuth((token) => motionApi.addTemplate(token, node_id, body, org))
  );

  server.registerTool(
    'motion_tool',
    {
      title: 'Run a frame editor tool',
      description:
        'Every tool of the motion editor agent (add_clip, set_props, set_keyframes, add_template, set_canvas, export_image... over 140), run directly on a video with no AI and no credits. ' +
        'No `tool`: lists them by name. `tool` alone: its description and JSON input schema. `tool` with `node_id`: runs it on the saved video with `input`; an edit is saved as a new revision (`version` answers the new one; pass the `version` you read to refuse a stale write with 409; a tool that refuses is an error with its reason). ' +
        'Prefer `tool` "batch" with `input` { ops: [{ tool, input }, ...] } (up to 500): every op in one revision, all or none. ' +
        'Still graphics: `set_canvas` with `still` (seconds of the frame) and `format` "4:5" post, "9:16" story or "A poster"; `export_image` (`format` png, jpg, webp; `scale` 1 or 2) saves the image to the project and returns its `url`. ' +
        'Tools that need a chat turn (research, voice, sub-agents) answer with an error: use `ask_motion_agent` for those.',
      inputSchema: z.object({ org, tool: z.string().optional(), node_id: z.string().optional(), input: z.record(z.string(), z.unknown()).optional(), version: z.number().int().min(0).optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, tool, node_id, input, version }) =>
      withAuth((token) => {
        if (!tool) {
          return motionApi.tools(token, undefined, org);
        }
        if (!node_id) {
          return motionApi.tools(token, tool, org);
        }
        return motionApi.runTool(token, node_id, { tool, ...(input ? { input } : {}), ...(version === undefined ? {} : { version }) }, org);
      })
  );

  server.registerTool(
    'motion_editor_op',
    {
      title: 'Run a frame editor action',
      description:
        'The actions the frame editor page runs on a `motion` node (`node_id`), same answers as the page, with `input` in camelCase. ' +
        `Reads: ${EDITOR_READS}. Writes: ${EDITOR_WRITES}. ` +
        'Unknown op answers the list; bad input answers the issues; a stale `version` answers 409.',
      inputSchema: z.object({ org, node_id: z.string(), op: z.string(), input: z.record(z.string(), z.unknown()).optional() }),
      annotations: { readOnlyHint: false, destructiveHint: true }
    },
    async ({ org, node_id, op, input }) => withAuth((token) => motionApi.editorOp(token, node_id, { op, input }, org))
  );

  server.registerTool(
    'list_motion_videos',
    {
      title: 'List frames',
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
      title: 'Publish a frame as a web embed',
      description:
        'Host the interactive web export of the saved revision on feega and return the public `url` and a `snippet` to paste ' +
        'into any site: feega\'s loader script and a `<feega-motion>` element that fills 100% of its box, reading playback and scroll length from feega (keeps pointer, tilt, scroll, key and tap input; live components such as games and generative pieces run live there). Publishing again updates the same embed in place, so the site needs no ' +
        'new paste. Also returns `react` and `flutter`: the same embed for a React app (`@feega/motion-react`) or a Flutter app (`feega_motion`), running the same player. `action: "unpublish"` takes it down. Videos from an uncensored project are refused (403, `refusal`). Free.',
      inputSchema: z.object({ org, node_id: z.string(), action: z.enum(['publish', 'unpublish']).optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({ org, node_id, action }) => withAuth((token) => (action === 'unpublish' ? motionApi.unembed(token, node_id, org) : motionApi.embed(token, node_id, org)))
  );

  server.registerTool(
    'motion_budget',
    {
      title: 'Read or raise the budget of a frame',
      description:
        'What a motion video has spent on AI across all its agent turns (`spent_usd`) and what it may spend (`cap_usd`). ' +
        'When an ask returns `video_budget`, the agent stopped because the video used its budget: its work is saved. ' +
        '`action: "raise"` adds `raise_usd` to the cap (only when the user asked to continue), then `ask_motion_agent` continues.',
      inputSchema: z.object({ org, node_id: z.string(), action: z.enum(['read', 'raise']).optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({ org, node_id, action }) => withAuth((token) => (action === 'raise' ? motionApi.raiseBudget(token, node_id, org) : motionApi.budget(token, node_id, org)))
  );

  server.registerTool(
    'view_motion_frames',
    {
      title: 'See still images of a frame',
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
      title: 'Read a frame web embed',
      description:
        'Whether the web embed of a motion video is `published`, its public `url`, the loader `snippet` and the saved `revision`. ' +
        'The self-contained HTML file (no hosting) is downloaded with `feega motion embed <node> --download <file>`, or GET ' +
        '`/api/v1/motion/{node_id}/embed/bundle`. Reads only.',
      inputSchema: z.object({ org, node_id: z.string() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, node_id }) => withAuth((token) => motionApi.embedState(token, node_id, org))
  );
}
