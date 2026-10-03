import { findClip, type MotionClip, type MotionDoc } from './doc';
import { editAt, valueAt } from './inspector';
import type { OpResult } from './timeline';

export type MaskBox = { x: number; y: number; width: number; height: number; rotation: number };
type Frame = { width: number; height: number };
type Delta = { dx: number; dy: number };
type Point = { x: number; y: number };

export enum Grab {
  Body = 'body',
  TopLeft = 'top-left',
  TopRight = 'top-right',
  BottomRight = 'bottom-right',
  BottomLeft = 'bottom-left'
}

export const CORNERS: Record<Exclude<Grab, Grab.Body>, { sx: number; sy: number }> = {
  [Grab.TopLeft]: { sx: -1, sy: -1 },
  [Grab.TopRight]: { sx: 1, sy: -1 },
  [Grab.BottomRight]: { sx: 1, sy: 1 },
  [Grab.BottomLeft]: { sx: -1, sy: 1 }
};

const BOX_KEYS: Record<keyof MaskBox, string> = { x: 'maskX', y: 'maskY', width: 'maskWidth', height: 'maskHeight', rotation: 'maskRotation' };

function turn(p: Point, degrees: number): Point {
  const r = (degrees * Math.PI) / 180;
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
}

function local(box: MaskBox, delta: Delta, frame: Frame): Point {
  return turn({ x: delta.dx * frame.width, y: delta.dy * frame.height }, -box.rotation);
}

export function dragBox(box: MaskBox, grab: Grab, delta: Delta, frame: Frame): MaskBox {
  if (grab === Grab.Body) {
    return { ...box, x: box.x + delta.dx, y: box.y + delta.dy };
  }

  const { sx, sy } = CORNERS[grab];
  const d = local(box, delta, frame);
  const width = Math.max(0, box.width * frame.width + sx * d.x);
  const height = Math.max(0, box.height * frame.height + sy * d.y);
  const shift = turn({ x: (sx * (width - box.width * frame.width)) / 2, y: (sy * (height - box.height * frame.height)) / 2 }, box.rotation);
  return { ...box, x: box.x + shift.x / frame.width, y: box.y + shift.y / frame.height, width: width / frame.width, height: height / frame.height };
}

export function pointAt(box: MaskBox, [u, v]: readonly [number, number], frame: Frame): Point {
  const offset = turn({ x: (u - 0.5) * box.width * frame.width, y: (v - 0.5) * box.height * frame.height }, box.rotation);
  return { x: box.x * frame.width + offset.x, y: box.y * frame.height + offset.y };
}

export function cornerAt(box: MaskBox, corner: Exclude<Grab, Grab.Body>, frame: Frame): Point {
  const { sx, sy } = CORNERS[corner];
  return pointAt(box, [(sx + 1) / 2, (sy + 1) / 2], frame);
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function dragPoint(points: readonly [number, number][], index: number, box: MaskBox, delta: Delta, frame: Frame): [number, number][] {
  const d = local(box, delta, frame);
  const du = box.width ? d.x / (box.width * frame.width) : 0;
  const dv = box.height ? d.y / (box.height * frame.height) : 0;
  return points.map(([u, v], i) => (i === index ? [clamp01(u + du), clamp01(v + dv)] : [u, v]));
}

export function maskBox(clip: MotionClip, frame: number): MaskBox | null {
  if (!clip.mask) {
    return null;
  }
  const read = (key: keyof MaskBox) => Number(valueAt(clip, BOX_KEYS[key], frame, (c) => c));
  return { x: read('x'), y: read('y'), width: read('width'), height: read('height'), rotation: read('rotation') };
}

export function editMaskAt(doc: MotionDoc, clip: MotionClip, patch: Partial<MaskBox>, frame: number): OpResult {
  let result: OpResult = { ok: true, doc };
  for (const [key, value] of Object.entries(patch) as [keyof MaskBox, number][]) {
    if (!result.ok) {
      return result;
    }
    result = editAt(result.doc, findClip(result.doc, clip.id)!.clip, BOX_KEYS[key], value, frame);
  }
  return result;
}
