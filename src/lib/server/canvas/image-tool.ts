import type { Db } from '$lib/server/db/client';
import { createConnection, createNode, findNode, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import type { Actor } from '$lib/server/repos/actor';
import { runGenNode, type RunOutcome } from '$lib/server/canvas/generate';
import { detectLayers } from '$lib/server/canvas/layer-detect';
import { IMAGE_TOOL_MODEL, ImageTool, imageToolParams } from '$lib/image-tools';
import { layerPrompt } from '$lib/layer-boxes';
import { pixelSizeOf, storePng } from '$lib/server/canvas/edit-assets';
import { maskPng } from '$lib/server/image-mask';
import type { Mask } from '$lib/image-mask';

const COLUMN_GAP = 80;
const DEFAULT_NODE_WIDTH = 320;

export type ImageToolDeps = {
  findNode: typeof findNode;
  createNode: typeof createNode;
  createConnection: typeof createConnection;
  runGenNode: typeof runGenNode;
  detectLayers: typeof detectLayers;
  pixelSizeOf: typeof pixelSizeOf;
  storePng: typeof storePng;
};

export const IMAGE_TOOL_DEPS: ImageToolDeps = { findNode, createNode, createConnection, runGenNode, detectLayers, pixelSizeOf, storePng };

type ImageToolInput = {
  orgId: string;
  projectId: string;
  userId: string;
  sourceNodeId: string;
  tool: ImageTool;
  factor?: string;
  prompt?: string;
  mask?: Mask;
  actor?: Actor;
};

export type ImageToolStart =
  | { ok: true; canvasId: string; nodeId: string; outcome: RunOutcome }
  | { ok: false; error: string };

type Plan = { ok: true; name: string; prompt: string; params: Record<string, string>; extra: Record<string, unknown> } | { ok: false; error: string };

type PlanContext = { db: Db; deps: ImageToolDeps; input: ImageToolInput; source: CanvasNodeRecord };

const planOf = (name: string, params: Record<string, string>): Plan => ({ ok: true, name, prompt: '', params, extra: {} });

const PLAN: Record<ImageTool, (context: PlanContext) => Promise<Plan>> = {
  [ImageTool.RemoveBackground]: async ({ input }) => planOf('Remove background', imageToolParams(input.tool, input.factor)),
  [ImageTool.Upscale]: async ({ input }) => {
    const params = imageToolParams(input.tool, input.factor);
    return planOf(`Upscale ${params.upscale_factor}×`, params);
  },
  [ImageTool.SplitLayers]: async ({ db, deps, input, source }) => {
    const layers = await deps.detectLayers(db, { orgId: input.orgId, assetId: String(source.data.refId) });
    if (!layers.length) {
      return { ok: false, error: 'no_layers_found' };
    }
    return { ok: true, name: 'Layers', prompt: layerPrompt(layers), params: imageToolParams(input.tool, input.factor), extra: { layerBoxes: layers } };
  },
  [ImageTool.Inpaint]: async ({ db, deps, input, source }) => {
    if (!input.prompt) {
      return { ok: false, error: 'prompt_required' };
    }
    if (!input.mask) {
      return { ok: false, error: 'mask_required' };
    }
    const size = await deps.pixelSizeOf(db, { orgId: input.orgId, assetId: String(source.data.refId) });
    if (!size) {
      return { ok: false, error: 'source_size_unknown' };
    }
    const png = await maskPng(size, input.mask);
    const stored = await deps.storePng(db, { orgId: input.orgId, projectId: input.projectId, userId: input.userId, nodeId: source.id, png, ...size });
    return { ok: true, name: 'Inpaint', prompt: input.prompt, params: imageToolParams(input.tool, input.factor), extra: { maskRefId: stored.id } };
  }
};

function refusalOf(source: CanvasNodeRecord | null): string | null {
  if (!source) {
    return 'node_not_found';
  }
  if (source.type !== 'image') {
    return 'source_not_image';
  }
  return source.data.refId ? null : 'source_empty';
}

export async function startImageTool(db: Db, deps: ImageToolDeps, input: ImageToolInput): Promise<ImageToolStart> {
  const source = await deps.findNode(db, { orgId: input.orgId, nodeId: input.sourceNodeId });
  const refusal = refusalOf(source);
  if (refusal || !source) {
    return { ok: false, error: refusal ?? 'node_not_found' };
  }

  const plan = await PLAN[input.tool]({ db, deps, input, source });
  if (!plan.ok) {
    return plan;
  }

  const model = IMAGE_TOOL_MODEL[input.tool];
  const actor = input.actor ?? { kind: 'user' as const, id: input.userId };
  const node = await deps.createNode(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    canvasId: source.canvasId,
    type: 'image',
    x: source.position.x + (source.size.width ?? DEFAULT_NODE_WIDTH) + COLUMN_GAP,
    y: source.position.y,
    displayName: plan.name,
    data: { prompt: plan.prompt, model, params: plan.params, ...plan.extra },
    actor
  });
  await deps.createConnection(db, { orgId: input.orgId, canvasId: source.canvasId, sourceNodeId: source.id, targetNodeId: node.id, actor });

  const outcome = await deps.runGenNode(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    canvasId: source.canvasId,
    nodeId: node.id,
    userId: input.userId,
    medium: 'image',
    prompt: plan.prompt,
    model,
    params: plan.params as never,
    expectedVersion: node.version,
    actor
  });
  if (outcome.kind === 'refused') {
    return { ok: false, error: outcome.error };
  }
  return { ok: true, canvasId: source.canvasId, nodeId: node.id, outcome };
}
