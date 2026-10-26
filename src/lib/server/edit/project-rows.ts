import { z } from 'zod';
import { findNode, patchNodeData, DataCheck } from '$lib/server/repos/canvas';
import { listProjectAssets } from '$lib/server/repos/assets';
import { AGENT_PATCH_ANSWERS, NODE_NOT_FOUND, type CanvasDeps } from '$lib/server/canvas/canvas-ops';
import { audioDescription } from '$lib/server/canvas/audio-description';
import { applyEffectsTo, makeEffectsPair } from '$lib/server/canvas/effects-actions';
import { effectsCatalogue } from '$lib/canvas/effects/catalogue';
import { effectListing } from '$lib/server/effects/listing';
import { effectStore } from '$lib/server/effects/store';
import { CheckState, Outcome } from '$lib/server/repos/effects';
import { describeNodeType, describeNodeTypes, isNodeType } from '$lib/canvas/node-data';
import { listGallery } from '$lib/server/repos/gallery';
import { cardView, publishNode, remixInto } from '$lib/server/gallery/service';
import { DurationBand, GalleryKind, gallerySearchSchema, itemPath } from '$lib/gallery/model';
import { MOTION_FORMATS } from '@feega/motion-core/motion/doc';
import { templateLibrary } from '$lib/server/motion/templates';
import { componentKind } from '$lib/motion/template/catalogue';
import { compositionOf } from '$lib/canvas-node-data';
import { FORMAT_OF_ASPECT, composedTemplate, sequentialIds } from '$lib/canvas/composition-template';
import { ToolAccess, ToolFamily, type ToolRow } from './tool-row';
import type { Actor } from '$lib/server/repos/actor';

const NOT_A_COMPOSITION = { outcome: 'invalid', message: 'That node is not a composition.' };

export type ProjectRowParts = {
  effects: ReturnType<typeof effectStore>;
  components: () => ReturnType<ReturnType<typeof templateLibrary>['list']>;
  actor: Actor;
};

export function projectRows(deps: CanvasDeps, { effects, components, actor }: ProjectRowParts): ToolRow[] {
  return [
    {
      name: 'describe_node_types',
      family: ToolFamily.Canvas,
      access: ToolAccess.Read,
      summary: 'The JSON schema of `data` for one node type, or for every type when type is omitted. Read it before create_node or update_node on a type you have not written yet.',
      input: z.object({ type: z.string().optional() }).strict(),
      run: async (input: { type?: string }) => {
        if (!input.type) {
          return { types: describeNodeTypes() };
        }
        if (!isNodeType(input.type)) {
          return { error: 'unknown_type', message: `Unknown type "${input.type}".` };
        }
        const audio = input.type === 'audio' ? await audioDescription() : {};
        return { types: { [input.type]: describeNodeType(input.type) }, ...audio };
      }
    },

    {
      name: 'list_assets',
      family: ToolFamily.Assets,
      access: ToolAccess.Read,
      summary:
        'List assets of THIS project — what its nodes produced and what was uploaded into it. Text lives in `content`; images and video in `url`.',
      input: z.object({}).strict(),
      run: async () => {
        const assets = await listProjectAssets(deps.db, { orgId: deps.orgId, projectId: deps.projectId });
        return { assets };
      }
    },

    {
      name: 'list_components',
      family: ToolFamily.Canvas,
      access: ToolAccess.Read,
      summary: 'The motion component library a composition node can play (set_composition_component): id, name, kind, seconds and fields (key, type, label). Free, reads only.',
      input: z.object({}).strict(),
      run: async () => ({
        components: (await components()).map((e) => ({
          id: e.id,
          name: e.template.name,
          description: e.template.description,
          kind: componentKind(e),
          seconds: e.template.doc.durationInFrames / e.template.doc.fps,
          fields: e.template.doc.fields.map((f) => ({ key: f.key, type: f.type, label: f.label }))
        }))
      })
    },

    {
      name: 'set_composition_component',
      family: ToolFamily.Canvas,
      access: ToolAccess.Write,
      summary: [
        'Put a composition node of THIS project on a library component (id from list_components), with its field values by key; component null puts it back on its own media layout.',
        'Images, videos and motions wired into the node fill the component media fields by themselves, in order: do not pass media values.',
        'Free. Returns { outcome: "invalid" } for an unknown component or field.'
      ].join(' '),
      input: z.object({ nodeId: z.string(), component: z.string().nullable(), values: z.record(z.string(), z.string()).default({}) }).strict(),
      run: async (input: { nodeId: string; component: string | null; values?: Record<string, string> }) => {
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
    },

    {
      name: 'list_effects',
      family: ToolFamily.Generate,
      access: ToolAccess.Read,
      summary: 'Every image effect apply_effects accepts, with its params (range, options, default), and the custom effects of the workspace (write_effect) with the step that puts each in a stack. Free, reads only.',
      input: z.object({}).strict(),
      run: async () => {
        const custom = (await effects.list()) ?? [];
        return {
          effects: effectsCatalogue(),
          custom: custom.map(effectListing)
        };
      }
    },

    {
      name: 'write_effect',
      family: ToolFamily.Generate,
      access: ToolAccess.Write,
      summary: [
        'Write a custom effect for the whole workspace, free: a GLSL ES 1.0 fragment body defining vec4 effect(vec2 uv).',
        'Given: uniform sampler2D u_src (the image), vec2 u_res, float u_time, float u_seed, varying v_uv, float hash(vec2), float noise(vec2).',
        'Every param becomes a uniform u_<key> (number → float, color → vec3, seed → float); keys src, res, time, seed are taken.',
        'No #extension, no derivatives, for loops with a constant bound ≤ 64, ≤ 16 texture2D, ≤ 12 KB. Same name replaces it.',
        'Returns the check; then put { id: "custom", ref: effect_id, params } in apply_effects. Motion clips: ask_motion_agent.'
      ].join(' '),
      input: z.object({ name: z.string(), frag: z.string(), params: z.array(z.record(z.string(), z.unknown())).max(12).default([]) }).strict(),
      run: async (input: { name: string; frag: string; params: Record<string, unknown>[] }) => {
        const written = await effects.write(input as never);
        if (written.outcome !== Outcome.Ok) {
          return { ok: false, error: `${written.outcome}${written.problems?.length ? `: ${written.problems.join('; ')}` : ''}` };
        }
        const { effect } = written;
        return { ok: effect.check.state !== CheckState.Failed, effect_id: effect.id, name: effect.name, version: effect.version, check: effect.check };
      }
    },

    {
      name: 'apply_effects',
      family: ToolFamily.Generate,
      access: ToolAccess.Write,
      summary: [
        'Apply one effect or a chain of effects (list_effects) to an image, free: no credits.',
        'On an image node: creates an effects node beside it, wired to it, and renders the chain into a new asset.',
        'On an effects node: replaces its stack with effects when given, otherwise re-renders the stack it has.',
        'effects: [{ id, params?, enabled? }] in order; params omitted take their defaults.'
      ].join(' '),
      input: z
        .object({
          nodeId: z.string(),
          effects: z.array(z.record(z.string(), z.unknown())).optional()
        })
        .strict(),
      run: async (input: { nodeId: string; effects?: Record<string, unknown>[] }) =>
        applyEffectsTo(deps.db, { orgId: deps.orgId, nodeId: input.nodeId, effects: input.effects, actor })
    },

    {
      name: 'make_effects_pair',
      family: ToolFamily.Generate,
      access: ToolAccess.Write,
      summary:
        'For an effects node with a shape-cutout step: creates its A/B twin (same shapes and seed, other side), wired to the same image, and renders it. Free.',
      input: z.object({ nodeId: z.string() }).strict(),
      run: async (input: { nodeId: string }) => makeEffectsPair(deps.db, { orgId: deps.orgId, nodeId: input.nodeId, actor })
    },


    {
      name: 'search_gallery',
      family: ToolFamily.Gallery,
      access: ToolAccess.Read,
      summary:
        'Search the public gallery of free motion videos and compositions anyone can remix (many by Feega). Filters: query (title words), kind, format, duration (short up to 6 s, medium 6 to 15 s, long over 15 s), tag. Returns id, title, author, format, seconds, remixes and url. Free, reads only.',
      input: z
        .object({
          query: z.string().max(80).optional(),
          kind: z.enum(GalleryKind).optional(),
          format: z.enum(MOTION_FORMATS).optional(),
          duration: z.enum(DurationBand).optional(),
          tag: z.string().max(24).optional()
        })
        .strict(),
      run: async (input: { query?: string; kind?: GalleryKind; format?: (typeof MOTION_FORMATS)[number]; duration?: DurationBand; tag?: string }) => {
        const search = gallerySearchSchema.parse({ q: input.query, kind: input.kind, format: input.format, duration: input.duration, tag: input.tag });
        return { items: (await listGallery(deps.db, search)).map((card) => cardView(card)) };
      }
    },

    {
      name: 'remix_gallery_item',
      family: ToolFamily.Gallery,
      access: ToolAccess.Write,
      summary:
        'Remix a gallery item, free: copies its video and files into a new Frame node (type motion) of THIS project (on canvasId, or on the Motion canvas), with its main texts, colours, logo and media exposed as fields. Then offer to put the user brand on it: open the editor and ask the motion agent. Returns nodeId and editorPath.',
      input: z.object({ itemId: z.string(), canvasId: z.string().optional() }).strict(),
      run: async (input: { itemId: string; canvasId?: string }) => {
        const remixed = await remixInto({ db: deps.db, orgId: deps.orgId, userId: deps.userId, actor }, { itemId: input.itemId, projectId: deps.projectId, canvasId: input.canvasId ?? null });
        return remixed.ok ? { nodeId: remixed.start.nodeId, canvasId: remixed.start.canvasId, editorPath: remixed.editorPath } : { error: remixed.error, message: remixed.message };
      }
    },

    {
      name: 'publish_to_gallery',
      family: ToolFamily.Gallery,
      access: ToolAccess.Write,
      summary:
        'Publish a Frame node (type motion) of the workspace to the public gallery, free, so anyone can remix it. Only when the user asks. Refused for uncensored projects, real brands (their logo, a script about a real brand, logos or pictures imported from a website) and content the moderation refuses. title up to 80 characters, description up to 500, up to 8 one-word tags. Returns the gallery id and url.',
      input: z.object({ nodeId: z.string(), title: z.string(), description: z.string().optional(), tags: z.array(z.string()).optional() }).strict(),
      run: async (input: { nodeId: string; title: string; description?: string; tags?: string[] }) => {
        const { nodeId, ...meta } = input;
        const published = await publishNode({ db: deps.db, orgId: deps.orgId, userId: deps.userId, actor }, { nodeId, meta });
        return published.ok ? { id: published.id, url: itemPath(published.id) } : { error: published.error, message: published.message };
      }
    }
  ];
}
