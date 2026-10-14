import type { Db } from '$lib/server/db/client';
import { createCanvas, createNode, listCanvases, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { frameNodeOf, newMotionData } from '$lib/canvas/motion-node';
import type { MotionFormat } from '$lib/motion/doc';
import { nodeSize } from '$lib/canvas/node-size';
import { placeBeside, type Rect } from '$lib/canvas/placement';
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

export enum CanvasPick {
  Motion = 'motion',
  New = 'new'
}

type StartInput = { orgId: string; projectId: string; canvasId: string | null; userId: string; name: string; format?: MotionFormat; near?: string[]; at?: { x: number; y: number }; picture?: Picture; actor?: Actor; pick?: CanvasPick };

type Picture = { width: number; height: number };

async function motionCanvasId(db: Db, deps: MotionStartDeps, input: StartInput): Promise<string | null> {
  if (!input.canvasId && input.pick === CanvasPick.New) {
    return (await deps.createCanvas(db, { orgId: input.orgId, projectId: input.projectId, name: input.name })).id;
  }

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

function rectOf(n: CanvasNodeRecord): Rect {
  const fallback = nodeSize(n.type, n.data);
  return { x: n.position.x, y: n.position.y, w: n.size.width ?? fallback.w, h: n.size.height ?? fallback.h };
}

function rightOf(rects: Rect[]): { x: number; y: number } {
  return rects.length ? { x: Math.max(...rects.map((r) => r.x + r.w)) + NODE_GAP, y: Math.min(...rects.map((r) => r.y)) } : { x: 0, y: 0 };
}

function spotFor(nodes: CanvasNodeRecord[], size: { w: number; h: number }, near: string[] = []): { x: number; y: number } {
  const occupied = nodes.map(rectOf);
  const related = nodes.filter((n) => near.includes(n.id)).map(rectOf);
  if (!related.length) {
    return { x: rightOf(occupied).x, y: 0 };
  }
  return placeBeside(related, size, occupied);
}

export function frameShape(picture: Picture): { data: Record<string, unknown>; width: number; height: number } {
  const shaped = frameNodeOf(picture);
  return { data: shaped.data, width: shaped.w, height: shaped.h };
}

const shapeOf = (input: StartInput) => (input.picture ? frameShape(input.picture) : { data: newMotionData(input.format) });

function sizeOf(shape: { data: Record<string, unknown>; width?: number; height?: number }): { w: number; h: number } {
  const fallback = nodeSize('motion', shape.data);
  return { w: shape.width ?? fallback.w, h: shape.height ?? fallback.h };
}

export async function startMotion(db: Db, deps: MotionStartDeps, input: StartInput): Promise<MotionStart | null> {
  const canvasId = await motionCanvasId(db, deps, input);
  if (!canvasId) {
    return null;
  }

  const node = await deps.createNode(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    canvasId,
    type: 'motion',
    ...(input.at ?? spotFor(await deps.listNodes(db, { orgId: input.orgId, canvasId }), sizeOf(shapeOf(input)), input.near)),
    displayName: input.name,
    ...shapeOf(input),
    actor: input.actor ?? { kind: 'user', id: input.userId }
  });

  return { projectId: input.projectId, canvasId, nodeId: node.id };
}
