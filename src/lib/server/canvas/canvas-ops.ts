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
import { runGenNode, runsOf, type RunOutcome } from '$lib/server/canvas/generate';
import { agentActor, type Actor } from '$lib/server/repos/actor';
import { withBrandContext, withOrgContext } from '$lib/server/ai-log';
import { GEN_MEDIUMS, isGenMedium, type GenParams } from '$lib/canvas/gen-node';
import { connectRefusal, nodeModelError, targetTakesNoInputs, UNCENSORED_NO_INPUTS_ERROR } from '$lib/server/canvas/node-model';
import { unknownFieldsError, validateNewNodeData } from '$lib/canvas/node-data';

export type CanvasDeps = {
  db: Db;
  orgId: string;
  projectId: string;
  userId: string;
  brandId?: string | null;
};

export type CanvasCtx = CanvasDeps & {
  actor: Actor;
  billed: <T>(fn: () => Promise<T>) => Promise<T>;
};

export function canvasCtx(deps: CanvasDeps): CanvasCtx {
  const billed = <T>(fn: () => Promise<T>): Promise<T> =>
    deps.brandId ? withBrandContext(deps.brandId, fn) : withOrgContext(deps.orgId, fn);
  return { ...deps, actor: agentActor(deps.userId), billed };
}

export const NODE_NOT_FOUND = { error: 'node_not_found', message: 'No live node with that id in this project.' };

const UNCENSORED_TARGET_REFUSED = {
  error: UNCENSORED_NO_INPUTS_ERROR,
  message: 'The target node uses an uncensored model, which takes no inputs of any kind. Switch its model first.'
};

export const AGENT_PATCH_ANSWERS: Record<PatchWrite['outcome'], (written: PatchWrite) => unknown> = {
  written: (written) => ({ outcome: 'written', node: (written as Extract<PatchWrite, { outcome: 'written' }>).node }),
  conflict: () => ({ outcome: 'conflict', message: 'Node kept changing while writing. Retry.' }),
  invalid: (written) => ({ outcome: 'invalid', message: (written as Extract<PatchWrite, { outcome: 'invalid' }>).error }),
  gone: () => NODE_NOT_FOUND
};

const BAD_MEDIUM = { error: 'bad_medium', message: `medium must be one of: ${GEN_MEDIUMS.join(', ')}.` };

export function outcomeOf(out: RunOutcome): Record<string, unknown> {
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

export enum Access {
  Read = 'read',
  Write = 'write',
  Spend = 'spend'
}

type Op<S extends z.ZodType> = {
  access: Access;
  input: S;
  run: (ctx: CanvasCtx, input: z.infer<S>) => Promise<unknown>;
};

const op = <S extends z.ZodType>(o: Op<S>): Op<S> => o;

const listCanvasesInput = z.object({}).strict();
const listNodesInput = z.object({ canvasId: z.string().describe('Canvas id from list_canvases.') }).strict();
const createNodeInput = z
  .object({
    canvasId: z.string(),
    type: z.string(),
    x: z.number(),
    y: z.number(),
    displayName: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional()
  })
  .strict();
const updateNodeInput = z
  .object({
    nodeId: z.string(),
    data: z.record(z.string(), z.unknown()).describe('Only the fields to change.')
  })
  .strict();
const moveNodeInput = z
  .object({
    nodeId: z.string(),
    x: z.number(),
    y: z.number(),
    z: z.number().optional().describe('Stacking order. Omit to leave it unchanged.')
  })
  .strict();
const connectNodesInput = z
  .object({
    canvasId: z.string(),
    sourceNodeId: z.string(),
    targetNodeId: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional()
  })
  .strict();
const nodeIdInput = z.object({ nodeId: z.string() }).strict();
const runNodeInput = z
  .object({
    nodeId: z.string(),
    medium: z.enum(GEN_MEDIUMS),
    prompt: z.string().optional().describe('Omit to keep the prompt already on the node.'),
    model: z.string().optional().describe('Omit to keep the model already on the node.'),
    params: z.record(z.string(), z.unknown()).optional().describe('e.g. { aspectRatio: "1:1", duration: 8 }.'),
    expectedVersion: z.number().int()
  })
  .strict();

export const CANVAS_OPS = {
  list_canvases: op({
    access: Access.Read,
    input: listCanvasesInput,
    run: async (ctx) => ({ canvases: await listCanvases(ctx.db, { orgId: ctx.orgId, projectId: ctx.projectId }) })
  }),

  list_nodes: op({
    access: Access.Read,
    input: listNodesInput,
    run: async (ctx, input) => ({ nodes: await listNodes(ctx.db, { orgId: ctx.orgId, canvasId: input.canvasId }) })
  }),

  create_node: op({
    access: Access.Write,
    input: createNodeInput,
    run: async (ctx, input) => {
      const verdict = validateNewNodeData(input.type, input.data ?? {});
      if (!verdict.ok) {
        return { outcome: 'invalid', message: verdict.error };
      }
      const badModel = await nodeModelError(input.type, input.data);
      if (badModel) {
        return { outcome: 'invalid', message: badModel };
      }

      const node = await createNode(ctx.db, {
        orgId: ctx.orgId,
        projectId: ctx.projectId,
        canvasId: input.canvasId,
        type: input.type,
        x: input.x,
        y: input.y,
        displayName: input.displayName ?? null,
        data: verdict.data,
        actor: ctx.actor
      });
      return { outcome: 'written', node };
    }
  }),

  update_node: op({
    access: Access.Write,
    input: updateNodeInput,
    run: async (ctx, input) => {
      const current = await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
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

      const written = await patchNodeData(ctx.db, {
        orgId: ctx.orgId,
        nodeId: input.nodeId,
        patch: input.data,
        check: DataCheck.Schema,
        actor: ctx.actor
      });
      return AGENT_PATCH_ANSWERS[written.outcome](written);
    }
  }),

  move_node: op({
    access: Access.Write,
    input: moveNodeInput,
    run: async (ctx, input) => {
      const node = await moveNode(ctx.db, { orgId: ctx.orgId, ...input, actor: ctx.actor });
      if (!node) {
        return NODE_NOT_FOUND;
      }
      return { node };
    }
  }),

  connect_nodes: op({
    access: Access.Write,
    input: connectNodesInput,
    run: async (ctx, input) => {
      if (await targetTakesNoInputs(ctx.db, { orgId: ctx.orgId, targetNodeId: input.targetNodeId })) {
        return UNCENSORED_TARGET_REFUSED;
      }

      const refusal = await connectRefusal(ctx.db, { orgId: ctx.orgId, sourceNodeId: input.sourceNodeId, targetNodeId: input.targetNodeId });
      if (refusal) {
        return { error: 'edge_refused', message: refusal };
      }

      const connection = await createConnection(ctx.db, {
        orgId: ctx.orgId,
        canvasId: input.canvasId,
        sourceNodeId: input.sourceNodeId,
        targetNodeId: input.targetNodeId,
        sourceHandle: input.sourceHandle ?? null,
        targetHandle: input.targetHandle ?? null,
        actor: ctx.actor
      });
      return { connection };
    }
  }),

  delete_node: op({
    access: Access.Write,
    input: nodeIdInput,
    run: async (ctx, input) => {
      await deleteNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId, actor: ctx.actor });
      return { deleted: true, nodeId: input.nodeId };
    }
  }),

  run_node: op({
    access: Access.Spend,
    input: runNodeInput,
    run: async (ctx, input) => {
      const medium = input.medium;
      if (!isGenMedium(medium)) {
        return BAD_MEDIUM;
      }

      const node = await findNode(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId });
      if (!node) {
        return NODE_NOT_FOUND;
      }

      const data = node.data as { prompt?: string; model?: string; params?: GenParams };
      const out = await ctx.billed(() =>
        runGenNode(ctx.db, {
          orgId: ctx.orgId,
          projectId: ctx.projectId,
          canvasId: node.canvasId,
          nodeId: node.id,
          userId: ctx.userId,
          medium,
          prompt: input.prompt ?? data.prompt ?? '',
          model: input.model ?? data.model ?? null,
          params: (input.params ?? data.params ?? {}) as GenParams,
          expectedVersion: input.expectedVersion,
          actor: ctx.actor
        })
      );

      return outcomeOf(out);
    }
  }),

  list_runs: op({
    access: Access.Read,
    input: nodeIdInput,
    run: async (ctx, input) => ({ runs: await runsOf(ctx.db, { orgId: ctx.orgId, nodeId: input.nodeId }) })
  })
};

export type CanvasOpName = keyof typeof CANVAS_OPS;

export function isCanvasOp(name: string): name is CanvasOpName {
  return Object.hasOwn(CANVAS_OPS, name);
}
