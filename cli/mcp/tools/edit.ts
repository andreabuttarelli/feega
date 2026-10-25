import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { editApi } from '../../lib/edit.ts';
import type { RawAnswer } from '../../lib/api.ts';
import type { ToolSurface } from '../tool-surface.ts';
import { DESCRIBE, TOOL_FAMILY } from '../surface.ts';
import { requireAuth, fail, ok, okText, type ToolResult } from '../util.ts';

const HTTP_ERROR_FROM = 400;

const org = z.string().optional().describe('Which org, if you belong to more than one.');

const step = z.object({
  op: z.string().describe('An op name from `describe`.'),
  target: z.string().optional().describe('Id of the node or frame the op acts on.'),
  element: z.string().optional().describe('Id of an element inside the target frame.'),
  input: z.record(z.string(), z.unknown()).optional(),
  version: z.number().int().min(0).optional().describe('Frame revision you read; a stale one is refused with 409.')
});

type Frame = { time: number; mime: string; data: string };

enum Shape {
  Structured = 'structured',
  Text = 'text'
}

function shown(answer: RawAnswer, plain: Shape): ToolResult {
  const body = answer.body;
  if (answer.status >= HTTP_ERROR_FROM) {
    return fail(typeof body === 'string' ? body : JSON.stringify(body));
  }
  const frames = (body as { frames?: Frame[] } | null)?.frames;
  if (!Array.isArray(frames)) {
    return plain === Shape.Text ? okText(body) : ok(body);
  }
  const { frames: _drawn, ...notes } = body as { frames: Frame[] } & Record<string, unknown>;
  const text = { ...notes, times: frames.map((f) => f.time) };
  return { content: [{ type: 'text', text: JSON.stringify(text) }, ...frames.map((f) => ({ type: 'image' as const, data: f.data, mimeType: f.mime }))], structuredContent: text };
}

async function call(run: (token: string) => Promise<RawAnswer>, plain = Shape.Structured): Promise<ToolResult> {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.result;
  }
  try {
    return shown(await run(auth.session.access_token), plain);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export function registerEditTools(server: McpServer, surface: ToolSurface) {
  server.registerTool(
    'edit',
    {
      title: 'Edit the canvas and its frames',
      description:
        'The one way to change a canvas: nodes, free elements, frames and what is inside a frame. You never pick an endpoint, the server routes by `op`. ' +
        'Op "describe": {} gives the three families (canvas|frame|editor) with counts; {family} its op names, access (read|write|spend|editor) and one line; {op} or {ops:[...]} strict JSON input schemas. ' +
        'One op: {op, target?, element?, input?, version?, project_id?}. `target` = the node or frame id the op acts on (a frame op requires it); `element` = an element id inside that frame; they fill the id fields of the op\'s input (nodeId, frameId, elementId, clip_id, clip_ids) unless you set them. `project_id` is needed by a canvas op without a `target`. ' +
        'Batch: op "batch" with `ops:[{op,target?,element?,input?},...]` (up to 500), canvas and frame ops mixed, run in order. Consecutive ops on the same frame are ONE revision, all or none. Across steps nothing is atomic: it stops at the first failure and answers `applied` (steps done), `failed` (index) and each step\'s result; earlier steps stay. A later step cannot use an id created by an earlier one: create first, then batch. ' +
        'In a frame: element ids come from `view` canvas_summary/get; move or restyle with set_props/set_transform; `version` refuses a stale write. Free canvas element or node: move_node, resize_node, rename_node, update_node, delete_node. Between frames: move_frame_element. ' +
        'Names shared by two registries: the canvas op keeps the name, the frame tool becomes `frame_<name>`, the editor action `editor_<name>` (e.g. list_templates = canvas, frame_list_templates). ' +
        'Access in describe: read and write are free, spend costs credits (run_node, generate_voiceover), editor needs a chat turn in the app (recreate_ui, add_music). Errors answer the reason, with `fix` when known.',
      inputSchema: z.object({ org, project_id: z.string().optional(), verbose: z.boolean().optional().describe('Whole documents back, not ids and changed fields.'), ops: z.array(step).max(500).optional() }).extend(step.shape).partial({ op: true }),
      annotations: { readOnlyHint: false, destructiveHint: true }
    },
    async ({ org, ...body }) => {
      if (body.op && surface.isLocal(body.op) && body.op in TOOL_FAMILY) {
        return surface.run(body.op, { ...(org ? { org } : {}), ...(body.input ?? {}) });
      }
      return call((token) => editApi.edit(token, body as never, org), body.op === DESCRIBE ? Shape.Text : Shape.Structured);
    }
  );

  server.registerTool(
    'view',
    {
      title: 'See the canvas',
      description:
        'Read the canvas in one call; free. Op "describe" lists the ops with strict schemas. ' +
        'canvas_summary {canvas_id}: every node (id, type, title, x/y, size, inputs/outputs, last run status) and, per frame, its element tree (id, kind, name, bounds in px, text, start/duration seconds). ' +
        'get {id} one node in full, or {id, frame_id} one element of a frame with props, transform, keyframes. ' +
        'activity {canvas_id, since?}: recent structural events (who/what/when), runs still working; presence is not readable from the server and is reported as unavailable. ' +
        'snapshot {node_id, time?, width?}: the frame as an IMAGE you can see, with the quality gate; drawn by the server renderer, or by the renderer of the deployed app when the server has none (answers server_frames_unavailable, 503, only when neither is reachable); a whole canvas, a region or one element cannot be drawn alone, snapshot its frame. About 10 snapshots a minute per workspace. ' +
        'Also reads: list_nodes / canvas_snapshot (raw) via `edit`; the saved doc via `edit` get_motion_doc; tables via `query`.',
      inputSchema: z.object({ org, op: z.string(), input: z.record(z.string(), z.unknown()).optional() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, op, input }) => call((token) => editApi.view(token, { op, input }, org))
  );
}
