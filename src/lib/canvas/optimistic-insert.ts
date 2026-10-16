import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { MOTION_NODE_BAR_H, atFirstRevision, motionNodeSize, drawnFrameNodeOf, elementNodeOf, frameNodeOf } from './motion-node';
import { MotionFormat, type MotionDoc } from '$lib/motion/doc';
import { DrawTool } from '$lib/motion/draw-tool';
import { drawnElement, drawnOf, type CanvasBox, type DrawnWire } from '$lib/motion/draw-create';
import { PENDING_FRAME_TYPE } from './pending-frame';

const OUTPUT_SIDE = 320;

type Placement = { id: string; canvasId: string; projectId: string; name: string | null; at: { x: number; y: number }; doc: { width: number; height: number } };

export function placedFrame(p: Placement): CanvasNodeRecord {
  const shaped = frameNodeOf(p.doc);
  return {
    id: p.id,
    canvasId: p.canvasId,
    projectId: p.projectId,
    type: 'motion',
    displayName: p.name,
    position: { ...p.at, z: 0 },
    size: { width: shaped.w, height: shaped.h },
    data: atFirstRevision(shaped.data),
    version: 0
  };
}

export function settle<T extends { id: string }>(tiles: T[], id: string, saved: T | null): T[] {
  return saved ? tiles.map((t) => (t.id === id ? saved : t)) : tiles.filter((t) => t.id !== id);
}

export function pendingOutput(id: string, drop: { x: number; y: number }): CanvasNodeRecord {
  return {
    id,
    canvasId: '',
    projectId: '',
    type: PENDING_FRAME_TYPE,
    displayName: null,
    position: { x: drop.x - OUTPUT_SIDE / 2, y: drop.y - OUTPUT_SIDE / 2, z: 0 },
    size: { width: OUTPUT_SIDE, height: OUTPUT_SIDE },
    data: {},
    version: 0
  };
}

const GHOST_FILL = 'rgba(17,17,17,0.08)';
const GHOST_STROKE = '#111111';

const GHOST_PAINT = `fill="${GHOST_FILL}" stroke="${GHOST_STROKE}" stroke-width="1.5" vector-effect="non-scaling-stroke"`;

type Ghost = { wire: DrawnWire; box: CanvasBox; doc: MotionDoc };

function ghostText({ box, doc }: Ghost): string {
  const clip = doc.tracks.flatMap((t) => t.clips)[0];
  const size = Number(clip?.props.size ?? 0) * Math.min(doc.width, doc.height) * (box.width / doc.width);
  return `<text x="${box.width / 2}" y="${box.height / 2}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="${size}" fill="${String(clip?.props.color ?? GHOST_STROKE)}">${String(clip?.props.text ?? '')}</text>`;
}

const GHOST_SHAPE: Record<DrawnWire['tool'], (ghost: Ghost) => string> = {
  [DrawTool.Pen]: ({ wire, box }) => `<path d="${wire.tool === DrawTool.Pen ? wire.path : ''}" transform="translate(${-box.left} ${-box.top})" ${GHOST_PAINT}/>`,
  [DrawTool.Ellipse]: ({ box }) => `<ellipse cx="${box.width / 2}" cy="${box.height / 2}" rx="${box.width / 2}" ry="${box.height / 2}" ${GHOST_PAINT}/>`,
  [DrawTool.Rectangle]: ({ box }) => `<rect width="${box.width}" height="${box.height}" ${GHOST_PAINT}/>`,
  [DrawTool.Text]: ghostText
};

function ghostSvg(ghost: Ghost): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ghost.box.width} ${ghost.box.height}" overflow="visible">${GHOST_SHAPE[ghost.wire.tool](ghost)}</svg>`;
}

export function drawnTile(id: string, wire: DrawnWire): { node: CanvasNodeRecord; look: string } | null {
  const drawn = drawnOf(wire);
  const made = typeof drawn === 'string' ? null : drawnElement(drawn, id);
  if (!made?.ok) {
    return null;
  }
  const shaped = elementNodeOf(made.box);
  const node: CanvasNodeRecord = {
    id,
    canvasId: '',
    projectId: '',
    type: 'motion',
    displayName: null,
    position: { x: made.box.left, y: made.box.top, z: 0 },
    size: { width: shaped.w, height: shaped.h },
    data: atFirstRevision(shaped.data),
    version: 0
  };
  return { node, look: `data:image/svg+xml,${encodeURIComponent(ghostSvg({ wire, box: made.box, doc: made.doc }))}` };
}

export function drawnFrameTile(id: string, box: CanvasBox): CanvasNodeRecord {
  const shaped = drawnFrameNodeOf(box);
  return {
    id,
    canvasId: '',
    projectId: '',
    type: 'motion',
    displayName: null,
    position: { x: box.left, y: box.top, z: 0 },
    size: { width: shaped.w, height: shaped.h },
    data: atFirstRevision(shaped.data),
    version: 0
  };
}

export function defaultFrameBox(at: { x: number; y: number }): CanvasBox {
  const node = motionNodeSize(MotionFormat.Landscape);
  const width = node.w;
  const height = node.h - MOTION_NODE_BAR_H;
  return { left: at.x - width / 2, top: at.y - height / 2, width, height };
}
