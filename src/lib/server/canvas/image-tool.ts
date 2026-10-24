import type { Db } from '$lib/server/db/client';
import { createConnection, createNode, findNode } from '$lib/server/repos/canvas';
import type { Actor } from '$lib/server/repos/actor';
import { runGenNode, type RunOutcome } from '$lib/server/canvas/generate';
import { IMAGE_TOOL_MODEL, ImageTool, imageToolParams } from '$lib/image-tools';

const COLUMN_GAP = 80;
const DEFAULT_NODE_WIDTH = 320;

export type ImageToolDeps = {
  findNode: typeof findNode;
  createNode: typeof createNode;
  createConnection: typeof createConnection;
  runGenNode: typeof runGenNode;
};

export const IMAGE_TOOL_DEPS: ImageToolDeps = { findNode, createNode, createConnection, runGenNode };

type ImageToolInput = {
  orgId: string;
  projectId: string;
  userId: string;
  sourceNodeId: string;
  tool: ImageTool;
  factor?: string;
  actor?: Actor;
};

export type ImageToolStart =
  | { ok: true; canvasId: string; nodeId: string; outcome: RunOutcome }
  | { ok: false; error: string };

const NODE_NAME: Record<ImageTool, (params: Record<string, string>) => string> = {
  [ImageTool.RemoveBackground]: () => 'Remove background',
  [ImageTool.Upscale]: (params) => `Upscale ${params.upscale_factor}×`
};

export async function startImageTool(db: Db, deps: ImageToolDeps, input: ImageToolInput): Promise<ImageToolStart> {
  const source = await deps.findNode(db, { orgId: input.orgId, nodeId: input.sourceNodeId });
  if (!source) {
    return { ok: false, error: 'node_not_found' };
  }
  if (source.type !== 'image') {
    return { ok: false, error: 'source_not_image' };
  }
  if (!source.data.refId) {
    return { ok: false, error: 'source_empty' };
  }

  const model = IMAGE_TOOL_MODEL[input.tool];
  const params = imageToolParams(input.tool, input.factor);
  const actor = input.actor ?? { kind: 'user' as const, id: input.userId };
  const node = await deps.createNode(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    canvasId: source.canvasId,
    type: 'image',
    x: source.position.x + (source.size.width ?? DEFAULT_NODE_WIDTH) + COLUMN_GAP,
    y: source.position.y,
    displayName: NODE_NAME[input.tool](params),
    data: { prompt: '', model, params },
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
    prompt: '',
    model,
    params: params as never,
    expectedVersion: node.version,
    actor
  });
  if (outcome.kind === 'refused') {
    return { ok: false, error: outcome.error };
  }
  return { ok: true, canvasId: source.canvasId, nodeId: node.id, outcome };
}
