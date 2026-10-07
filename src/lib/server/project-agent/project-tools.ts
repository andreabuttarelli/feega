import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import {
  createConnection,
  createNode,
  deleteNode,
  findNode,
  listCanvases,
  listNodes,
  moveNode,
  patchNodeData,
  DataCheck,
  type PatchWrite
} from '$lib/server/repos/canvas';
import { listProjectAssets } from '$lib/server/repos/assets';
import { runGenNode, runsOf, type RunOutcome } from '$lib/server/canvas/generate';
import { agentActor, type Actor } from '$lib/server/repos/actor';
import { withBrandContext, withOrgContext } from '$lib/server/ai-log';
import { GEN_MEDIUMS, isGenMedium, type GenParams } from '$lib/canvas/gen-node';
import { audioDescription } from '$lib/server/canvas/audio-description';
import { connectRefusal, nodeModelError, targetTakesNoInputs, UNCENSORED_NO_INPUTS_ERROR } from '$lib/server/canvas/node-model';
import { applyEffectsTo, makeEffectsPair } from '$lib/server/canvas/effects-actions';
import { effectsCatalogue } from '$lib/canvas/effects/catalogue';
import { describeNodeType, describeNodeTypes, isNodeType, unknownFieldsError, validateNewNodeData } from '$lib/canvas/node-data';

/**
 * I TOOL DI PROGETTO E TELA. Sempre presenti, anche senza brand.
 *
 * Ogni tool parla solo ai repository, e i repository portano `org_id` su ogni query: è lì che
 * sta il tenant, non qui. Le descrizioni sono product copy per il modello — dicono il confine
 * (questo progetto, non altri) e non promettono nulla che il tool non fa.
 */
export type ProjectToolDeps = {
  db: Db;
  orgId: string;
  projectId: string;
  userId: string;
  /** Assente = nessun brand: la spesa atterra sull'org. */
  brandId?: string | null;
};

const NODE_NOT_FOUND = { error: 'node_not_found', message: 'No live node with that id in this project.' };
const UNCENSORED_TARGET_REFUSED = {
  error: UNCENSORED_NO_INPUTS_ERROR,
  message: 'The target node uses an uncensored model, which takes no inputs of any kind. Switch its model first.'
};
const AGENT_PATCH_ANSWERS: Record<PatchWrite['outcome'], (written: PatchWrite) => unknown> = {
  written: (written) => ({ outcome: 'written', node: (written as Extract<PatchWrite, { outcome: 'written' }>).node }),
  conflict: () => ({ outcome: 'conflict', message: 'Node kept changing while writing. Retry.' }),
  invalid: (written) => ({ outcome: 'invalid', message: (written as Extract<PatchWrite, { outcome: 'invalid' }>).error }),
  gone: () => NODE_NOT_FOUND
};

const BAD_MEDIUM = { error: 'bad_medium', message: `medium must be one of: ${GEN_MEDIUMS.join(', ')}.` };

function outcomeOf(out: RunOutcome): Record<string, unknown> {
  if (out.kind === 'done') {
    return { outcome: 'done', runId: out.run.id, assetId: out.asset.id, assetType: out.asset.type };
  }
  if (out.kind === 'queued') {
    return { outcome: 'queued', runId: out.run.id, externalJobId: out.run.externalJobId };
  }
  if (out.kind === 'conflict') {
    return { outcome: 'conflict', message: 'Node was written by someone else. Re-read it and retry with the new version.' };
  }
  return { outcome: 'refused', error: out.error };
}

export function createProjectTools(deps: ProjectToolDeps): Record<string, Tool> {
  const actor: Actor = agentActor(deps.userId);

  /** La generazione spende: il costo deve atterrare sul brand, o sull'org se non ce n'è uno. */
  const billed = <T>(fn: () => Promise<T>): Promise<T> =>
    deps.brandId ? withBrandContext(deps.brandId, fn) : withOrgContext(deps.orgId, fn);

  return {
    list_canvases: tool({
      description:
        'List the canvases of THIS project. One project only — never other projects, never a brand.',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const canvases = await listCanvases(deps.db, { orgId: deps.orgId, projectId: deps.projectId });
        return { canvases };
      }
    }),

    list_nodes: tool({
      description:
        'List live nodes on one canvas of THIS project (id, type, position, data, version). Read this before update_node or run_node: the version is required and the data is what you must resend.',
      inputSchema: z.object({ canvasId: z.string().describe('Canvas id from list_canvases.') }).strict(),
      execute: async (input: { canvasId: string }) => {
        const nodes = await listNodes(deps.db, { orgId: deps.orgId, canvasId: input.canvasId });
        return { nodes };
      }
    }),

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

    create_node: tool({
      description: [
        'Create a node on a canvas of THIS project. data must match the type exactly (describe_node_types): unknown fields and missing required fields are refused.',
        'To put written text on the canvas (copy, hooks, notes, a script) use type "doc" with data { content: "<markdown>", public: false } — the canvas shows content as it is.',
        'A "text" node is a generator: data { prompt } is the instruction, and its visible body appears only after run_node.'
      ].join(' '),
      inputSchema: z
        .object({
          canvasId: z.string(),
          type: z.string(),
          x: z.number(),
          y: z.number(),
          displayName: z.string().optional(),
          data: z.record(z.string(), z.unknown()).optional()
        })
        .strict(),
      execute: async (input: { canvasId: string; type: string; x: number; y: number; displayName?: string; data?: Record<string, unknown> }) => {
        const verdict = validateNewNodeData(input.type, input.data ?? {});
        if (!verdict.ok) {
          return { outcome: 'invalid', message: verdict.error };
        }
        const badModel = await nodeModelError(input.type, input.data);
        if (badModel) {
          return { outcome: 'invalid', message: badModel };
        }

        const node = await createNode(deps.db, {
          orgId: deps.orgId,
          projectId: deps.projectId,
          canvasId: input.canvasId,
          type: input.type,
          x: input.x,
          y: input.y,
          displayName: input.displayName ?? null,
          data: verdict.data,
          actor
        });
        return { outcome: 'written', node };
      }
    }),

    update_node: tool({
      description:
        'Change some fields of a node\'s data on THIS project. Send only the fields to change: the rest is kept, and a field set to null is removed. `params` and `filters` merge one level down; arrays replace whole. Returns { outcome: "invalid" } when the merged data breaks the node schema.',
      inputSchema: z
        .object({
          nodeId: z.string(),
          data: z.record(z.string(), z.unknown()).describe('Only the fields to change.')
        })
        .strict(),
      execute: async (input: { nodeId: string; data: Record<string, unknown> }) => {
        const current = await findNode(deps.db, { orgId: deps.orgId, nodeId: input.nodeId });
        if (!current) {
          return NODE_NOT_FOUND;
        }
        const unknown = unknownFieldsError(current.type, input.data);
        if (unknown) {
          return { outcome: 'invalid', message: unknown };
        }
        const badModel = await nodeModelError(current.type, input.data);
        if (badModel) {
          return { outcome: 'invalid', message: badModel };
        }

        const written = await patchNodeData(deps.db, {
          orgId: deps.orgId,
          nodeId: input.nodeId,
          patch: input.data,
          check: DataCheck.Schema,
          actor
        });
        return AGENT_PATCH_ANSWERS[written.outcome](written);
      }
    }),

    move_node: tool({
      description: 'Move a node on its canvas. Position only: last-write-wins, does not touch node data or version.',
      inputSchema: z
        .object({
          nodeId: z.string(),
          x: z.number(),
          y: z.number(),
          z: z.number().optional().describe('Stacking order. Omit to leave it unchanged.')
        })
        .strict(),
      execute: async (input: { nodeId: string; x: number; y: number; z?: number }) => {
        const node = await moveNode(deps.db, { orgId: deps.orgId, ...input, actor });
        if (!node) {
          return NODE_NOT_FOUND;
        }
        return { node };
      }
    }),

    connect_nodes: tool({
      description:
        'Connect two nodes on one canvas of THIS project. The edge is directed: source feeds target. Refused when the target node uses an uncensored model — those take no inputs of any kind, ever: switch the model first. Also refused when the source medium does not feed the target — an audio node only takes what its current operation needs (describe_node_types type "audio" lists them).',
      inputSchema: z
        .object({
          canvasId: z.string(),
          sourceNodeId: z.string(),
          targetNodeId: z.string(),
          sourceHandle: z.string().optional(),
          targetHandle: z.string().optional()
        })
        .strict(),
      execute: async (input: { canvasId: string; sourceNodeId: string; targetNodeId: string; sourceHandle?: string; targetHandle?: string }) => {
        if (await targetTakesNoInputs(deps.db, { orgId: deps.orgId, targetNodeId: input.targetNodeId })) {
          return UNCENSORED_TARGET_REFUSED;
        }

        const refusal = await connectRefusal(deps.db, { orgId: deps.orgId, sourceNodeId: input.sourceNodeId, targetNodeId: input.targetNodeId });
        if (refusal) {
          return { error: 'edge_refused', message: refusal };
        }

        const connection = await createConnection(deps.db, {
          orgId: deps.orgId,
          canvasId: input.canvasId,
          sourceNodeId: input.sourceNodeId,
          targetNodeId: input.targetNodeId,
          sourceHandle: input.sourceHandle ?? null,
          targetHandle: input.targetHandle ?? null,
          actor
        });
        return { connection };
      }
    }),

    delete_node: tool({
      description: 'Soft-delete a node on THIS project. The node disappears from list_nodes; undo can bring it back.',
      inputSchema: z.object({ nodeId: z.string() }).strict(),
      execute: async (input: { nodeId: string }) => {
        await deleteNode(deps.db, { orgId: deps.orgId, nodeId: input.nodeId, actor });
        return { deleted: true, nodeId: input.nodeId };
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

    run_node: tool({
      description:
        'Generate on a producing node of THIS project (text, image, video, audio or model3d — a model3d node turns one connected image, or its prompt via a generated product shot, into a GLB and is always queued). Costs credits: only when the user asked. Versioned like update_node — conflict means re-read and retry. A video or an audio dubbing may come back queued; poll with list_runs. An audio node runs params.operation (describe_node_types type "audio" lists operations and voices).',
      inputSchema: z
        .object({
          nodeId: z.string(),
          medium: z.enum(GEN_MEDIUMS),
          prompt: z.string().optional().describe('Omit to keep the prompt already on the node.'),
          model: z.string().optional().describe('Omit to keep the model already on the node.'),
          params: z.record(z.string(), z.unknown()).optional().describe('e.g. { aspectRatio: "1:1", duration: 8 }.'),
          expectedVersion: z.number().int()
        })
        .strict(),
      execute: async (input: {
        nodeId: string;
        medium: string;
        prompt?: string;
        model?: string;
        params?: Record<string, unknown>;
        expectedVersion: number;
      }) => {
        const medium = input.medium;
        if (!isGenMedium(medium)) {
          return BAD_MEDIUM;
        }

        const node = await findNode(deps.db, { orgId: deps.orgId, nodeId: input.nodeId });
        if (!node) {
          return NODE_NOT_FOUND;
        }

        const data = node.data as { prompt?: string; model?: string; params?: GenParams };
        const out = await billed(() =>
          runGenNode(deps.db, {
            orgId: deps.orgId,
            projectId: deps.projectId,
            canvasId: node.canvasId,
            nodeId: node.id,
            userId: deps.userId,
            medium,
            prompt: input.prompt ?? data.prompt ?? '',
            model: input.model ?? data.model ?? null,
            params: (input.params ?? data.params ?? {}) as GenParams,
            expectedVersion: input.expectedVersion,
            actor
          })
        );

        return outcomeOf(out);
      }
    }),

    list_effects: tool({
      description: 'Every image effect apply_effects accepts, with its params (range, options, default). Free, reads only.',
      inputSchema: z.object({}).strict(),
      execute: async () => ({ effects: effectsCatalogue() })
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

    list_runs: tool({
      description: 'Generation history of one node on THIS project, oldest first, with status, cost and the produced text when there is one.',
      inputSchema: z.object({ nodeId: z.string() }).strict(),
      execute: async (input: { nodeId: string }) => {
        const runs = await runsOf(deps.db, { orgId: deps.orgId, nodeId: input.nodeId });
        return { runs };
      }
    })
  };
}
