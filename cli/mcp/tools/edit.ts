import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { editApi } from '../../lib/edit.ts';
import type { RawAnswer } from '../../lib/api.ts';
import { requireAuth, fail, ok, type ToolResult } from '../util.ts';

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

function shown(answer: RawAnswer): ToolResult {
  const body = answer.body;
  if (answer.status >= HTTP_ERROR_FROM) {
    return fail(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  }
  const frames = (body as { frames?: Frame[] } | null)?.frames;
  if (!Array.isArray(frames)) {
    return ok(body);
  }
  const { frames: _drawn, ...notes } = body as { frames: Frame[] } & Record<string, unknown>;
  const text = { ...notes, times: frames.map((f) => f.time) };
  return { content: [{ type: 'text', text: JSON.stringify(text, null, 2) }, ...frames.map((f) => ({ type: 'image' as const, data: f.data, mimeType: f.mime }))], structuredContent: text };
}

async function call(run: (token: string) => Promise<RawAnswer>): Promise<ToolResult> {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.result;
  }
  try {
    return shown(await run(auth.session.access_token));
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export function registerEditTools(server: McpServer) {
  server.registerTool(
    'edit',
    {
      title: 'Edit the canvas and its frames',
      description:
        'The one way to change a canvas: nodes, free elements, frames and what is inside a frame. You never pick an endpoint, the server routes by `op`. ' +
        'Call op "describe" first: {} lists every op (name, family canvas|frame|editor, access, one line); {op} or {ops:[...]} give strict JSON input schemas; {schemas:true} gives all of them (large). ' +
        'One op: {op, target?, element?, input?, version?, project_id?}. `target` = the node or frame id the op acts on (a frame op requires it); `element` = an element id inside that frame; they fill the id fields of the op\'s input (nodeId, frameId, elementId, clip_id, clip_ids) unless you set them. `project_id` is needed by a canvas op without a `target`. ' +
        'Batch: op "batch" with `ops:[{op,target?,element?,input?},...]` (up to 500), canvas and frame ops mixed, run in order. Consecutive ops on the same frame are ONE revision, all or none. Across steps nothing is atomic: it stops at the first failure and answers `applied` (steps done), `failed` (index) and each step\'s result; earlier steps stay. A later step cannot use an id created by an earlier one: create first, then batch. ' +
        'In a frame: element ids come from `view` canvas_summary/get; move or restyle with set_props/set_transform; `version` refuses a stale write. Free canvas element or node: move_node, resize_node, update_node, delete_node. Between frames: move_frame_element. ' +
        'Names shared by two registries: the canvas op keeps the name, the frame tool becomes `frame_<name>`, the editor action `editor_<name>` (e.g. list_templates = canvas, frame_list_templates). ' +
        'Spending ops (run_node, generate_voiceover...) are marked access "spend" in describe and need credits. Errors answer the reason, with `fix` when known.',
      inputSchema: z.object({ org, project_id: z.string().optional(), ops: z.array(step).max(500).optional() }).extend(step.shape).partial({ op: true }),
      annotations: { readOnlyHint: false, destructiveHint: true }
    },
    async ({ org, ...body }) => call((token) => editApi.edit(token, body as never, org))
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
