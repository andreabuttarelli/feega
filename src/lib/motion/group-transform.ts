import { findClip, type MotionDoc } from './doc';
import type { EditMode } from './edit-mode';
import type { Transform } from './keyframes';
import { IDENTITY, apply2d, invert2d, transformAt, worldAt } from './parent';
import { anchorOf, snapMove, type Bounds, type Guide, type Pt } from './scene-select';
import { patchEach } from './space';
import type { OpResult } from './timeline';

const DEG = 180 / Math.PI;
const TINY = 1e-9;

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];

export function pullFactor(anchor: Pt, handle: Pt, to: Pt): number {
  const arm = sub(handle, anchor);
  const length = dot(arm, arm);
  return length < TINY ? 1 : dot(sub(to, anchor), arm) / length;
}

export function turnedBy(centre: Pt, from: Pt, to: Pt): number {
  const angle = (p: Pt) => Math.atan2(p[1] - centre[1], p[0] - centre[0]) * DEG;
  return angle(to) - angle(from);
}

function shiftPatch(doc: MotionDoc, id: string, frame: number, by: Pt): Transform {
  const clip = findClip(doc, id)!.clip;
  const size = { width: doc.width, height: doc.height };
  const parent = clip.parent ? worldAt(doc, clip.parent, frame, size) : IDENTITY;
  const [dx, dy] = apply2d(invert2d([parent[0], parent[1], parent[2], parent[3], 0, 0]), by);
  return { x: transformAt(clip, 'x', frame) + dx / size.width, y: transformAt(clip, 'y', frame) + dy / size.height };
}

type Value = (key: 'scaleX' | 'scaleY' | 'rotateZ') => number;
type Around = (pivot: Pt, value: Value) => { to: Pt; patch: Transform };

function aroundEach(doc: MotionDoc, ids: readonly string[], frame: number, mode: EditMode, around: Around): OpResult {
  const missing = ids.find((id) => !findClip(doc, id));
  if (missing) {
    return { ok: false, error: `no clip ${missing}` };
  }
  const patches = ids.map((id): [string, Transform] => {
    const clip = findClip(doc, id)!.clip;
    const pivot = anchorOf(doc, id, frame);
    const { to, patch } = around(pivot, (key) => transformAt(clip, key, frame));
    return [id, { ...patch, ...shiftPatch(doc, id, frame, sub(to, pivot)) }];
  });
  return patchEach(doc, patches, frame, mode);
}

export const scaleAroundXY = (doc: MotionDoc, ids: readonly string[], frame: number, point: Pt, fx: number, fy: number, mode: EditMode): OpResult =>
  aroundEach(doc, ids, frame, mode, (pivot, value) => ({
    to: [point[0] + (pivot[0] - point[0]) * fx, point[1] + (pivot[1] - point[1]) * fy],
    patch: { scaleX: value('scaleX') * fx, scaleY: value('scaleY') * fy }
  }));

export const scaleAround = (doc: MotionDoc, ids: readonly string[], frame: number, point: Pt, factor: number, mode: EditMode): OpResult => scaleAroundXY(doc, ids, frame, point, factor, factor, mode);

const MIN_FACTOR = 0.01;
const SIDE = 0.5;

export function resizeFactors(box: Bounds, unit: Pt, to: Pt, keepRatio: boolean, fromCentre: boolean): { anchor: Pt; fx: number; fy: number } {
  const at = (u: Pt): Pt => [box.left + u[0] * (box.right - box.left), box.top + u[1] * (box.bottom - box.top)];
  const anchor = fromCentre ? at([SIDE, SIDE]) : at([1 - unit[0], 1 - unit[1]]);
  const handle = at(unit);
  const activeX = unit[0] !== SIDE;
  const activeY = unit[1] !== SIDE;
  const along = (i: 0 | 1, active: boolean) => (active ? Math.max((to[i] - anchor[i]) / (handle[i] - anchor[i]), MIN_FACTOR) : 1);
  const [fx, fy] = [along(0, activeX), along(1, activeY)];
  if (keepRatio && activeX && activeY) {
    const uniform = Math.max(pullFactor(anchor, handle, to), MIN_FACTOR);
    return { anchor, fx: uniform, fy: uniform };
  }
  return { anchor, fx, fy };
}

export function snappedHandle(point: Pt, active: [boolean, boolean], others: Bounds[], size: { width: number; height: number }, reach: number): { point: Pt; guides: Guide[] } {
  const snapped = snapMove({ left: point[0], right: point[0], top: point[1], bottom: point[1] }, [0, 0], others, size, reach);
  const guides = snapped.guides.filter((g) => (g.axis === 'x' ? active[0] : active[1]));
  return { point: [point[0] + (active[0] ? snapped.offset[0] : 0), point[1] + (active[1] ? snapped.offset[1] : 0)], guides };
}

export function rotateAround(doc: MotionDoc, ids: readonly string[], frame: number, point: Pt, degrees: number, mode: EditMode): OpResult {
  const radians = degrees / DEG;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  return aroundEach(doc, ids, frame, mode, (pivot, value) => {
    const [dx, dy] = sub(pivot, point);
    return { to: [point[0] + dx * cos - dy * sin, point[1] + dx * sin + dy * cos], patch: { rotateZ: value('rotateZ') + degrees } };
  });
}
