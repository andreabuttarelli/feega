import type { Db } from '$lib/server/db/client';
import { createCanvas, createNode, listCanvases, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { newMotionData } from '$lib/canvas/motion-node';

export const MOTION_CANVAS_NAME = 'Motion';

const NODE_GAP = 80;

export type MotionStartDeps = {
  listCanvases: typeof listCanvases;
  createCanvas: typeof createCanvas;
  listNodes: typeof listNodes;
  createNode: typeof createNode;
};

export const MOTION_START_DEPS: MotionStartDeps = { listCanvases, createCanvas, listNodes, createNode };

export type MotionStart = { projectId: string; canvasId: string; nodeId: string };

type StartInput = { orgId: string; projectId: string; canvasId: string | null; userId: string; name: string };

async function motionCanvasId(db: Db, deps: MotionStartDeps, input: StartInput): Promise<string | null> {
  const canvases = await deps.listCanvases(db, { orgId: input.orgId, projectId: input.projectId });
  if (input.canvasId) {
    return canvases.find((c) => c.id === input.canvasId)?.id ?? null;
  }

  const dedicated = canvases.find((c) => c.name === MOTION_CANVAS_NAME);
  if (dedicated) {
    return dedicated.id;
  }
  return (await deps.createCanvas(db, { orgId: input.orgId, projectId: input.projectId, name: MOTION_CANVAS_NAME })).id;
}

function rightOf(nodes: CanvasNodeRecord[]): number {
  const edges = nodes.map((n) => n.position.x + (n.size.width ?? 0));
  return edges.length ? Math.max(...edges) + NODE_GAP : 0;
}

export async function startMotion(db: Db, deps: MotionStartDeps, input: StartInput): Promise<MotionStart | null> {
  const canvasId = await motionCanvasId(db, deps, input);
  if (!canvasId) {
    return null;
  }

  const nodes = await deps.listNodes(db, { orgId: input.orgId, canvasId });
  const node = await deps.createNode(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    canvasId,
    type: 'motion',
    x: rightOf(nodes),
    y: 0,
    displayName: input.name,
    data: newMotionData(),
    actor: { kind: 'user', id: input.userId }
  });

  return { projectId: input.projectId, canvasId, nodeId: node.id };
}
