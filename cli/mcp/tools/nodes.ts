import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { api, request } from '../../lib/api.ts';
import { withAuth } from '../util.ts';
import { generationView, mediaView } from '../media.ts';

/**
 * IL CLICK «GENERA» SULLA TELA, PER UN AGENTE. Non crea un nodo — quello è `insert_row` — genera
 * DENTRO uno che esiste già: `medium` deve corrispondere al `type` del nodo, o il server rifiuta
 * prima di spendere. Un video non torna mai pronto in questa chiamata: arriva `queued` con un
 * `external_job_id`, e un tick successivo (un cron, non questo tool) deposita il risultato — il
 * nodo resta `running` fino a lì. Un agente che aspetta un file qui aspetta per sempre.
 */
const org = z.string().optional().describe('Which org, if you belong to more than one.');

function call<T>(
  token: string,
  method: string,
  path: string,
  org: string | undefined,
  body?: unknown
): Promise<T> {
  const qs = new URLSearchParams(org ? { org } : {});
  const suffix = qs.toString() ? `?${qs}` : '';
  return request<T>(`${path}${suffix}`, token, { method, body: body ? JSON.stringify(body) : undefined });
}

export function registerNodeTools(server: McpServer) {
  server.registerTool(
    'run_node_generation',
    {
      title: 'Generate a node\'s content',
      description:
        'Generate into an existing canvas node — text, image, video, audio or model3d. This is the same engine ' +
        'the canvas Generate button calls; it never creates a node (`insert_row` does that). ' +
        '`medium` MUST match the node\'s own type, or the call is refused before anything is spent. ' +
        'Pass `version` as the node\'s current `nodes.version`: a stale value comes back `conflict` ' +
        '(never a silent overwrite) — re-read the node and retry with the fresh version. ' +
        'A `video` NEVER returns finished here: it comes back `queued` with an `external_job_id` on ' +
        'the run, and the render lands later, asynchronously — the node stays `running` until a ' +
        'later tick deposits the asset. Poll the node (`query`) rather than expecting a file now. ' +
        'An `audio` node runs one ElevenLabs operation set in `params.operation` (see `audio_operations` ' +
        'in `describe_node_types`); `describe_node_types` with `type: audio` also lists the voices. Audio `dubbing` is queued like a video. ' +
        'A `model3d` node turns ONE connected image into a GLB 3D model on a `wiro/` image-to-3D model. With no image but a ' +
        'prompt or connected text, it first draws a white-background product shot on the cheapest image model (billed too), ' +
        'then models that; with neither it is refused. Settings go in `params` (Trellis/Pixal3D `pipeline_type`, Hunyuan3D `generate_texture`). ' +
        'A finished result returns `asset_ids` and `media` with `preview_url`/`full_url` (see `get_media`). ' +
        'Omit `model` to keep the node\'s own model, or the recommended balanced one for the medium ' +
        'when it has none (`describe_node_types` lists the recommended ones). A model the canvas does ' +
        'not offer is refused with the recommended alternatives; an old or weak one still runs but ' +
        'the result carries a `warning` naming the recommended one. ' +
        'Models whose id starts with `wiro/` run on Wiro and are always queued like a video, after a ' +
        'safety screen that refuses with a readable reason. Uncensored `wiro/` models run only when the ' +
        'org owner turned them on in Settings; minors and real, identifiable people are refused regardless. ' +
        'An uncensored model takes NO input of any kind — no upstream connections, no picked references, ' +
        'no image/mask/init params — and the call is refused before anything is spent if any are present. ' +
        'Spends credits; a `credits_exhausted` failure means the org is out.',
      inputSchema: z.object({
        org,
        node_id: z.string(),
        medium: z.enum(['text', 'image', 'video', 'audio', 'model3d']),
        prompt: z.string(),
        model: z.string().optional(),
        version: z.number().int(),
        params: z.record(z.string(), z.unknown()).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id, ...input }) =>
      withAuth(async (token) => {
        const outcome = await call<Record<string, unknown>>(
          token, 'POST', `/api/v1/org/nodes/${encodeURIComponent(node_id)}/generate`, org,
          { ...input, params: input.params ?? {} }
        );
        return generationView(outcome, (asset) =>
          api.getMedia(token, { asset, org }).catch(() => ({ items: [], missing: asset })));
      })
  );

  server.registerTool(
    'get_media',
    {
      title: 'See a node\'s media',
      description:
        'View the image, video, audio, 3D model or text a node holds, a generation run produced, or an asset — ' +
        'by `node_ids`, `run_ids` and/or `asset_ids`. Per item: type, mime, width/height, duration, ' +
        'and two signed links: `preview_url` (images: 1024px long edge, valid 5 minutes — FETCH THIS to ' +
        'look at the image and judge it against the prompt) and `full_url` (the original file, valid 1 hour — ' +
        'give this to the user). Videos and audio have `full_url` only. Ids your org cannot see come back in ' +
        '`missing`. Reads only, spends nothing.',
      inputSchema: z.object({
        org,
        node_ids: z.array(z.string()).optional(),
        run_ids: z.array(z.string()).optional(),
        asset_ids: z.array(z.string()).optional()
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, node_ids, run_ids, asset_ids }) =>
      withAuth(async (token) =>
        mediaView(await api.getMedia(token, { node: node_ids, run: run_ids, asset: asset_ids, org }))
      )
  );

  server.registerTool(
    'list_effects',
    {
      title: 'List image effects',
      description:
        'Every image effect `apply_effects` accepts, with its params (range, options, default). ' +
        'Reads only, spends nothing.',
      inputSchema: z.object({ org }),
      annotations: { readOnlyHint: true }
    },
    async ({ org }) => withAuth((token) => call(token, 'GET', '/api/v1/org/effects', org))
  );

  server.registerTool(
    'apply_effects',
    {
      title: 'Apply image effects',
      description:
        'Applies one effect or a chain (`list_effects`) and lands the result as a new asset — the ' +
        'same render the canvas Effects editor does. On an image node it creates an `effects` node ' +
        'beside it, wired to it; on an `effects` node it replaces the stack with `effects` when ' +
        'given, otherwise re-renders the stack it has. `effects`: `[{ id, params?, enabled? }]` in ' +
        'order, missing params take their defaults. Returns `{ node_id, asset_id }`. Spends no ' +
        'credits: no AI provider is called.',
      inputSchema: z.object({
        org,
        node_id: z.string(),
        effects: z.array(z.record(z.string(), z.unknown())).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id, effects }) =>
      withAuth((token) =>
        call(token, 'POST', `/api/v1/org/nodes/${encodeURIComponent(node_id)}/apply-effects`, org, effects ? { effects } : undefined)
      )
  );

  server.registerTool(
    'make_effects_pair',
    {
      title: 'Make a shape cutout A/B pair',
      description:
        'For an `effects` node with a `shape-cutout` step: creates its twin (same shapes and seed, ' +
        'other side — shapes over the image vs fill with holes), wired to the same image, and ' +
        'renders it. Returns `{ node_id, asset_id }`. Free.',
      inputSchema: z.object({ org, node_id: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id }) =>
      withAuth((token) =>
        call(token, 'POST', `/api/v1/org/nodes/${encodeURIComponent(node_id)}/effects-pair`, org)
      )
  );

  server.registerTool(
    'run_node_loop',
    {
      title: 'Queue a generation node loop',
      description:
        'QUEUES many combinations from a node\'s `iterate` wires (or plain "repeat N" variants ' +
        'when it has none) to run through the SAME engine `run_node_generation` calls — one real ' +
        'run per combination, never a copy of it. This call returns as soon as the queue is ' +
        'written, NOT when the images exist: combinations run a few at a time as a background tick ' +
        'drains the queue over the following minutes, so 1000 combinations take longer than 50 to ' +
        'finish. Up to 50 queues on the call; above 50 it comes back `needs_confirmation` with the ' +
        'count and the credit cost — call again with `confirm: true`; above 1000 it is refused ' +
        'outright and the loop must be split. Credits for the WHOLE loop are checked up front, not ' +
        'discovered empty halfway. A failed combination never stops the others; results land in an ' +
        'output `list` node next to this one as they finish, each item labelled with which values ' +
        'produced it — poll that node (`query`) to see progress, do not expect it done here.',
      inputSchema: z.object({
        org,
        node_id: z.string(),
        confirm: z.boolean().optional().describe('Required (true) to queue above 50 combinations.')
      }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id, confirm }) =>
      withAuth((token) =>
        call(token, 'POST', `/api/v1/org/nodes/${encodeURIComponent(node_id)}/loop`, org, { confirm: confirm ?? false })
      )
  );

  server.registerTool(
    'preview_node_loop',
    {
      title: 'Preview a node\'s loop',
      description:
        'How many combinations `run_node_loop` would queue on this node right now, and what they ' +
        'would cost — reads only, spends nothing. Call this before `run_node_loop` when the count ' +
        'is not already known, rather than guessing at whether confirm will be needed.',
      inputSchema: z.object({ org, node_id: z.string() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, node_id }) =>
      withAuth((token) => call(token, 'GET', `/api/v1/org/nodes/${encodeURIComponent(node_id)}/loop`, org))
  );

  server.registerTool(
    'cancel_node_loop',
    {
      title: 'Cancel a queued loop',
      description:
        'Stops the combinations still queued for this node — the ones a tick has already claimed ' +
        'finish regardless, and anything already produced stays in the output list. Returns how ' +
        'many combinations it actually stopped.',
      inputSchema: z.object({ org, node_id: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, node_id }) =>
      withAuth((token) => call(token, 'DELETE', `/api/v1/org/nodes/${encodeURIComponent(node_id)}/loop`, org))
  );
}
