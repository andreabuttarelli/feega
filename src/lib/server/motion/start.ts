import type { Db } from '$lib/server/db/client';
import { createCanvas, createNode, listCanvases, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { newMotionData } from '$lib/canvas/motion-node';
import type { MotionFormat } from '$lib/motion/doc';
import type { Actor } from '$lib/server/repos/actor';

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

type StartInput = { orgId: string; projectId: string; canvasId: string | null; userId: string; name: string; format?: MotionFormat; near?: string[]; actor?: Actor };

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

function rightOf(nodes: CanvasNodeRecord[]): { x: number; y: number } {
  const edges = nodes.map((n) => n.position.x + (n.size.width ?? 0));
  return edges.length ? { x: Math.max(...edges) + NODE_GAP, y: Math.min(...nodes.map((n) => n.position.y)) } : { x: 0, y: 0 };
}

function spotFor(nodes: CanvasNodeRecord[], near: string[] = []): { x: number; y: number } {
  const related = nodes.filter((n) => near.includes(n.id));
  if (!related.length) {
    return { x: rightOf(nodes).x, y: 0 };
  }
  return rightOf(related);
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
    ...spotFor(nodes, input.near),
    displayName: input.name,
    data: newMotionData(input.format),
    actor: input.actor ?? { kind: 'user', id: input.userId }
  });

  return { projectId: input.projectId, canvasId, nodeId: node.id };
}
