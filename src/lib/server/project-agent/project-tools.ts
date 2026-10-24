import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { SIDEBAR_AGENT_KEY } from '$lib/server/repos/actor';
import { Access, CANVAS_OPS, canvasCtx, chatSendsOp, type CanvasCtx, type CanvasDeps, type CanvasOpName } from '$lib/server/canvas/canvas-ops';
import { effectStore } from '$lib/server/effects/store';
import { chromiumGl, serverFramesOpen } from '$lib/server/motion/chromium-frames';
import { templateLibrary } from '$lib/server/motion/templates';
import { toolsOf } from '$lib/server/edit/tool-row';
import { projectRows } from '$lib/server/edit/project-rows';

/**
 * I TOOL DI PROGETTO E TELA. Sempre presenti, anche senza brand.
 *
 * Ogni tool parla solo ai repository, e i repository portano `org_id` su ogni query: è lì che
 * sta il tenant, non qui. Le descrizioni sono product copy per il modello — dicono il confine
 * (questo progetto, non altri) e non promettono nulla che il tool non fa.
 */
export type ProjectToolDeps = CanvasDeps;

const CHAT_TOOL_OPS: Partial<Record<CanvasOpName, string>> = {
  list_canvases:
    'List the canvases of THIS project. One project only — never other projects, never a brand.',
  list_nodes:
    'List live nodes on one canvas of THIS project (id, type, position, data, version). Read this before update_node or run_node: the version is required and the data is what you must resend.',
  create_node:
    [
      'Create a node on a canvas of THIS project. data must match the type exactly (describe_node_types): unknown fields and missing required fields are refused.',
      'To put written text on the canvas (copy, hooks, notes, a script) use type "doc" with data { content: "<markdown>", public: false } — the canvas shows content as it is.',
      'A "text" node is a generator: data { prompt } is the instruction, and its visible body appears only after run_node.'
    ].join(' '),
  update_node:
    'Change some fields of a node\'s data on THIS project. Send only the fields to change: the rest is kept, and a field set to null is removed. `params` and `filters` merge one level down; arrays replace whole. Returns { outcome: "invalid" } when the merged data breaks the node schema.',
  move_node:
    'Move a node on its canvas. Position only: last-write-wins, does not touch node data or version.',
  connect_nodes:
    'Connect two nodes on one canvas of THIS project. The edge is directed: source feeds target. Refused when the target node uses an uncensored model — those take no inputs of any kind, ever: switch the model first. Also refused when the source medium does not feed the target — an audio node only takes what its current operation needs (describe_node_types type "audio" lists them).',
  move_frame_element:
    'Move one element (a clip: text, image, video, shape, component) out of a Frame into another Frame of THIS project, or onto the empty canvas as a free element (a Text, Box, Ellipse, Path or Image on its own, no frame around it, the size it had in its frame). Props, style and keyframes are kept and re-timed to the target frame rate; x/y (0..1 of the target frame) is where its centre lands. Never turns an element into a generative node. Both frames are saved as revisions.',
  place_in_frame:
    "Put the generated output of a Generate image, Generate video or Generate text node of THIS project into a Frame as an element (image, video at the frame's start, or text), centred at x/y (0..1). Omit toFrameId to put it on the canvas as a free element (Image, Video or Text, no frame around it). The generative node is not changed. A Frame takes no inputs: connect_nodes into a Frame is refused.",
  draw_element:
    'Draw a free graphic element on a canvas of THIS project, outside any frame: drawn { tool: "text" | "rectangle" | "ellipse", box: { left, top, width, height } } in canvas units, or { tool: "pen", path: "<SVG d in canvas units>" }. A text takes sizing auto (one line), auto-height or fixed. Not a Generate text node. Answers frame_id (the element node) and element_id (its clip): edit it with the frame tools.',
  group_elements:
    'Group two or more things on the canvas of THIS project into one Group; they keep their places and sizes and move as one. Free elements (type element) are drawn inside the Group; frames and other nodes join it (data.groupId) and keep working. Inside a frame, group clips with the frame tool precompose instead. section true wraps any nodes in a Section instead: a titled rectangle behind them that they join, so moving it moves them.',
  rotate_group:
    'Turn a Group on the canvas of THIS project by degrees (clockwise); everything in it, frames included, turns around the group centre.',
  ungroup_element:
    'Split a Group of free elements on the canvas of THIS project back into one element per shape, each where it was.',
  delete_node:
    'Soft-delete a node on THIS project. The node disappears from list_nodes; undo can bring it back.',
  run_node:
    'Generate on a producing node of THIS project (Generate text/image/video/audio/3D model; type ids text, image, video, audio, model3d — a model3d node turns one connected image, or its prompt via a generated product shot, into a GLB and is always queued). Costs credits: only when the user asked. Versioned like update_node — conflict means re-read and retry. A video or an audio dubbing may come back queued; poll with list_runs. An audio node runs params.operation (describe_node_types type "audio" lists operations and voices). Model ids, providers and prices: canvas_tool list_models; pass provider (a routes[].provider) to run on that one, omit for the cheapest healthy.',
  list_runs:
    'Generation history of one node on THIS project, oldest first, with status, cost and the produced text when there is one.',
  preview_node_loop:
    'How many combinations run_node_loop would queue on a node of THIS project, and what they would cost. Free, reads only: call it first when the count is unknown.',
  run_node_loop:
    'Queue every combination of a node\'s inputs (iterate wires, lists) as separate generations into a results list node; a cron runs them in the next minutes. Costs credits for the whole loop: only when the user asked. Above 50 combinations it answers needs_confirmation until confirm: true; above 1000 it is refused.',
  cancel_node_loop:
    'Stop the queued combinations of a node loop that have not started yet. Finished results stay.',
  preview_run_graph:
    'Plan a graph run on THIS project without spending: graph "downstream" (nodeId, then every node it feeds, in dependency order) or "stale" (on canvasId, every result older than its inputs; nodeIds narrows it). Returns the ordered steps and the credits. Free: always call it and tell the user the cost before run_graph.',
  run_graph:
    'Queue the steps preview_run_graph planned, same input; a cron runs each after the ones it depends on, a failed step stops what depends on it. Costs credits: only when the user agreed to the quoted cost. Cycles are refused.'
};

const OP_NAMES = Object.keys(CANVAS_OPS) as CanvasOpName[];
const GENERIC_OPS = OP_NAMES.filter((name) => chatSendsOp(name) && !(name in CHAT_TOOL_OPS));

function fieldsOf(schema: z.ZodType): string {
  const shape = schema instanceof z.ZodObject ? (schema.shape as Record<string, z.ZodType>) : {};
  return Object.entries(shape)
    .map(([key, field]) => (field.safeParse(undefined).success ? `${key}?` : key))
    .join(',');
}

const GENERIC_DESCRIPTION = [
  'Other canvas ops of THIS project, as API/MCP: op, camelCase input.',
  `Spend credits, only if the user asked: ${GENERIC_OPS.filter((name) => CANVAS_OPS[name].access === Access.Spend).join(', ')}.`,
  `Ops: ${GENERIC_OPS.map((name) => `${name} {${fieldsOf(CANVAS_OPS[name].input)}}`).join(';')}.`
].join(' ');

function canvasOpTools(ctx: CanvasCtx): Record<string, Tool> {
  const own = Object.entries(CHAT_TOOL_OPS).map(([name, description]) => {
    const op = CANVAS_OPS[name as CanvasOpName];
    return [name, tool({ description, inputSchema: op.input, execute: (input: unknown) => op.run(ctx, input as never) })];
  });

  const generic = tool({
    description: GENERIC_DESCRIPTION,
    inputSchema: z.object({ op: z.enum(GENERIC_OPS as [CanvasOpName, ...CanvasOpName[]]), input: z.record(z.string(), z.unknown()).default({}) }).strict(),
    execute: async ({ op, input }: { op: CanvasOpName; input?: Record<string, unknown> }) => {
      const parsed = CANVAS_OPS[op].input.safeParse(input ?? {});
      if (!parsed.success) {
        return { error: 'invalid_input', issues: parsed.error.issues };
      }
      return CANVAS_OPS[op].run(ctx, parsed.data as never);
    }
  });

  return { ...Object.fromEntries(own), canvas_tool: generic };
}

export function createProjectTools(deps: ProjectToolDeps): Record<string, Tool> {
  const ctx = canvasCtx(deps);
  const actor = ctx.actor;
  const effects = effectStore({ db: deps.db, orgId: deps.orgId, actor: { kind: 'agent', id: deps.userId, agentKey: SIDEBAR_AGENT_KEY }, gl: serverFramesOpen() ? chromiumGl : null });

  const components = () => templateLibrary(deps.db, { orgId: deps.orgId, actor }).list();

  return {
    ...canvasOpTools(ctx),
    ...toolsOf(projectRows(deps, { effects, components, actor }))
  };
}
