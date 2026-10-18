import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import { findNode, patchNodeData, DataCheck } from '$lib/server/repos/canvas';
import { listProjectAssets } from '$lib/server/repos/assets';
import { SIDEBAR_AGENT_KEY } from '$lib/server/repos/actor';
import { AGENT_PATCH_ANSWERS, Access, CANVAS_OPS, NODE_NOT_FOUND, canvasCtx, chatSendsOp, type CanvasCtx, type CanvasDeps, type CanvasOpName } from '$lib/server/canvas/canvas-ops';
import { audioDescription } from '$lib/server/canvas/audio-description';
import { applyEffectsTo, makeEffectsPair } from '$lib/server/canvas/effects-actions';
import { effectsCatalogue } from '$lib/canvas/effects/catalogue';
import { effectListing } from '$lib/server/effects/listing';
import { effectStore } from '$lib/server/effects/store';
import { CheckState, Outcome } from '$lib/server/repos/effects';
import { chromiumGl, serverFramesOpen } from '$lib/server/motion/chromium-frames';
import { describeNodeType, describeNodeTypes, isNodeType } from '$lib/canvas/node-data';
import { listGallery } from '$lib/server/repos/gallery';
import { cardView, publishNode, remixInto } from '$lib/server/gallery/service';
import { DurationBand, GalleryKind, gallerySearchSchema, itemPath } from '$lib/gallery/model';
import { MOTION_FORMATS } from '$lib/motion/doc';
import { templateLibrary } from '$lib/server/motion/templates';
import { componentKind } from '$lib/motion/template/catalogue';
import { compositionOf } from '$lib/canvas-node-data';
import { FORMAT_OF_ASPECT, composedTemplate, sequentialIds } from '$lib/canvas/composition-template';

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
    'Draw a free graphic element on a canvas of THIS project, outside any frame: drawn { tool: "text" | "rectangle" | "ellipse", box: { left, top, width, height } } in canvas units, or { tool: "pen", path: "<SVG d in canvas units>" }. It is a Text, Box, Ellipse or Path with the same fills, strokes, effects and text style as inside a frame; it is NOT a Generate text node. Answers frame_id (the element node) and element_id (its clip): edit it with the frame tools.',
  group_elements:
    'Group two or more things on the canvas of THIS project into one Group; they keep their places and sizes and move as one. Free elements (type motion, data.kind element) are drawn inside the Group; frames and other nodes join it (data.groupId) and keep working. Inside a frame, group clips with the frame tool precompose instead.',
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
  `Ops: ${GENERIC_OPS.map((name) => `${name} {${fieldsOf(CANVAS_OPS[name].input)}}`).join('; ')}.`
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

const NOT_A_COMPOSITION = { outcome: 'invalid', message: 'That node is not a composition.' };

export function createProjectTools(deps: ProjectToolDeps): Record<string, Tool> {
  const ctx = canvasCtx(deps);
  const actor = ctx.actor;
  const effects = effectStore({ db: deps.db, orgId: deps.orgId, actor: { kind: 'agent', id: deps.userId, agentKey: SIDEBAR_AGENT_KEY }, gl: serverFramesOpen() ? chromiumGl : null });

  /** La generazione spende: il costo deve atterrare sul brand, o sull'org se non ce n'è uno. */
  const components = () => templateLibrary(deps.db, { orgId: deps.orgId, actor }).list();

  return {
    ...canvasOpTools(ctx),

    describe_node_types: tool({
      description: 'The JSON schema of `data` for one node type, or for every type when type is omitted. Read it before create_node or update_node on a type you have not written yet.',
      inputSchema: z.object({ type: z.string().optional() }).strict(),
      execute: async (input: { type?: string }) => {
        if (!input.type) {
          return { types: describeNodeTypes() };
        }
        if (!isNodeType(input.type)) {
          return { error: 'unknown_type', message: `Unknown type "${input.type}".` };
        }
        const audio = input.type === 'audio' ? await audioDescription() : {};
        return { types: { [input.type]: describeNodeType(input.type) }, ...audio };
      }
    }),

    list_assets: tool({
      description:
        'List assets of THIS project — what its nodes produced and what was uploaded into it. Text lives in `content`; images and video in `url`.',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const assets = await listProjectAssets(deps.db, { orgId: deps.orgId, projectId: deps.projectId });
        return { assets };
      }
    }),

    list_components: tool({
      description: 'The motion component library a composition node can play (set_composition_component): id, name, kind, seconds and fields (key, type, label). Free, reads only.',
      inputSchema: z.object({}).strict(),
      execute: async () => ({
        components: (await components()).map((e) => ({
          id: e.id,
          name: e.template.name,
          description: e.template.description,
          kind: componentKind(e),
          seconds: e.template.doc.durationInFrames / e.template.doc.fps,
          fields: e.template.doc.fields.map((f) => ({ key: f.key, type: f.type, label: f.label }))
        }))
      })
    }),

    set_composition_component: tool({
      description: [
        'Put a composition node of THIS project on a library component (id from list_components), with its field values by key; component null puts it back on its own media layout.',
        'Images, videos and motions wired into the node fill the component media fields by themselves, in order: do not pass media values.',
        'Free. Returns { outcome: "invalid" } for an unknown component or field.'
      ].join(' '),
      inputSchema: z.object({ nodeId: z.string(), component: z.string().nullable(), values: z.record(z.string(), z.string()).default({}) }).strict(),
      execute: async (input: { nodeId: string; component: string | null; values?: Record<string, string> }) => {
        const current = await findNode(deps.db, { orgId: deps.orgId, nodeId: input.nodeId });
        if (!current) {
          return NODE_NOT_FOUND;
        }
        const node = compositionOf(current);
        if (!node) {
          return NOT_A_COMPOSITION;
        }

        const values = input.values ?? {};
        const entry = input.component ? (await components()).find((e) => e.id === input.component) : null;
        if (input.component && !entry) {
          return { outcome: 'invalid', message: `No component ${input.component}: call list_components.` };
        }
        const made = entry ? composedTemplate(entry, { format: FORMAT_OF_ASPECT[node.aspect], values }, [], sequentialIds()) : null;
        if (made && !made.ok) {
          return { outcome: 'invalid', message: made.error };
        }

        const written = await patchNodeData(deps.db, {
          orgId: deps.orgId,
          nodeId: input.nodeId,
          patch: { template: entry ? { id: entry.id, values } : null },
          check: DataCheck.Schema,
          actor
        });
        return AGENT_PATCH_ANSWERS[written.outcome](written);
      }
    }),

    list_effects: tool({
      description: 'Every image effect apply_effects accepts, with its params (range, options, default), and the custom effects of the workspace (write_effect) with the step that puts each in a stack. Free, reads only.',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const custom = (await effects.list()) ?? [];
        return {
          effects: effectsCatalogue(),
          custom: custom.map(effectListing)
        };
      }
    }),

    write_effect: tool({
      description: [
        'Write a custom effect for the whole workspace, free: a GLSL ES 1.0 fragment body defining vec4 effect(vec2 uv).',
        'Given: uniform sampler2D u_src (the image), vec2 u_res, float u_time, float u_seed, varying v_uv, float hash(vec2), float noise(vec2).',
        'Every param becomes a uniform u_<key> (number → float, color → vec3, seed → float); keys src, res, time, seed are taken.',
        'No #extension, no derivatives, for loops with a constant bound ≤ 64, ≤ 16 texture2D, ≤ 12 KB. Same name replaces it.',
        'Returns the check; then put { id: "custom", ref: effect_id, params } in apply_effects. Motion clips: ask_motion_agent.'
      ].join(' '),
      inputSchema: z.object({ name: z.string(), frag: z.string(), params: z.array(z.record(z.string(), z.unknown())).max(12).default([]) }).strict(),
      execute: async (input: { name: string; frag: string; params: Record<string, unknown>[] }) => {
        const written = await effects.write(input as never);
        if (written.outcome !== Outcome.Ok) {
          return { ok: false, error: `${written.outcome}${written.problems?.length ? `: ${written.problems.join('; ')}` : ''}` };
        }
        const { effect } = written;
        return { ok: effect.check.state !== CheckState.Failed, effect_id: effect.id, name: effect.name, version: effect.version, check: effect.check };
      }
    }),

    apply_effects: tool({
      description: [
        'Apply one effect or a chain of effects (list_effects) to an image, free: no credits.',
        'On an image node: creates an effects node beside it, wired to it, and renders the chain into a new asset.',
        'On an effects node: replaces its stack with effects when given, otherwise re-renders the stack it has.',
        'effects: [{ id, params?, enabled? }] in order; params omitted take their defaults.'
      ].join(' '),
      inputSchema: z
        .object({
          nodeId: z.string(),
          effects: z.array(z.record(z.string(), z.unknown())).optional()
        })
        .strict(),
      execute: async (input: { nodeId: string; effects?: Record<string, unknown>[] }) =>
        applyEffectsTo(deps.db, { orgId: deps.orgId, nodeId: input.nodeId, effects: input.effects, actor })
    }),

    make_effects_pair: tool({
      description:
        'For an effects node with a shape-cutout step: creates its A/B twin (same shapes and seed, other side), wired to the same image, and renders it. Free.',
      inputSchema: z.object({ nodeId: z.string() }).strict(),
      execute: async (input: { nodeId: string }) => makeEffectsPair(deps.db, { orgId: deps.orgId, nodeId: input.nodeId, actor })
    }),


    search_gallery: tool({
      description:
        'Search the public gallery of free motion videos and compositions anyone can remix (many by Feega). Filters: query (title words), kind, format, duration (short up to 6 s, medium 6 to 15 s, long over 15 s), tag. Returns id, title, author, format, seconds, remixes and url. Free, reads only.',
      inputSchema: z
        .object({
          query: z.string().max(80).optional(),
          kind: z.enum(GalleryKind).optional(),
          format: z.enum(MOTION_FORMATS).optional(),
          duration: z.enum(DurationBand).optional(),
          tag: z.string().max(24).optional()
        })
        .strict(),
      execute: async (input: { query?: string; kind?: GalleryKind; format?: (typeof MOTION_FORMATS)[number]; duration?: DurationBand; tag?: string }) => {
        const search = gallerySearchSchema.parse({ q: input.query, kind: input.kind, format: input.format, duration: input.duration, tag: input.tag });
        return { items: (await listGallery(deps.db, search)).map((card) => cardView(card)) };
      }
    }),

    remix_gallery_item: tool({
      description:
        'Remix a gallery item, free: copies its video and files into a new Frame node (type motion) of THIS project (on canvasId, or on the Motion canvas), with its main texts, colours, logo and media exposed as fields. Then offer to put the user brand on it: open the editor and ask the motion agent. Returns nodeId and editorPath.',
      inputSchema: z.object({ itemId: z.string(), canvasId: z.string().optional() }).strict(),
      execute: async (input: { itemId: string; canvasId?: string }) => {
        const remixed = await remixInto({ db: deps.db, orgId: deps.orgId, userId: deps.userId, actor }, { itemId: input.itemId, projectId: deps.projectId, canvasId: input.canvasId ?? null });
        return remixed.ok ? { nodeId: remixed.start.nodeId, canvasId: remixed.start.canvasId, editorPath: remixed.editorPath } : { error: remixed.error, message: remixed.message };
      }
    }),

    publish_to_gallery: tool({
      description:
        'Publish a Frame node (type motion) of the workspace to the public gallery, free, so anyone can remix it. Only when the user asks. Refused for uncensored projects, real brands (their logo, a script about a real brand, logos or pictures imported from a website) and content the moderation refuses. title up to 80 characters, description up to 500, up to 8 one-word tags. Returns the gallery id and url.',
      inputSchema: z.object({ nodeId: z.string(), title: z.string(), description: z.string().optional(), tags: z.array(z.string()).optional() }).strict(),
      execute: async (input: { nodeId: string; title: string; description?: string; tags?: string[] }) => {
        const { nodeId, ...meta } = input;
        const published = await publishNode({ db: deps.db, orgId: deps.orgId, userId: deps.userId, actor }, { nodeId, meta });
        return published.ok ? { id: published.id, url: itemPath(published.id) } : { error: published.error, message: published.message };
      }
    })
  };
}
