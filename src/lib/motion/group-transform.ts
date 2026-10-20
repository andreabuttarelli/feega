import { findClip, type MotionDoc } from './doc';
import type { EditMode } from './edit-mode';
import type { Transform } from './keyframes';
import { IDENTITY, apply2d, invert2d, transformAt, worldAt } from './parent';
import { anchorOf, type Pt } from './scene-select';
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

export const scaleAround = (doc: MotionDoc, ids: readonly string[], frame: number, point: Pt, factor: number, mode: EditMode): OpResult =>
  aroundEach(doc, ids, frame, mode, (pivot, value) => ({
    to: [point[0] + (pivot[0] - point[0]) * factor, point[1] + (pivot[1] - point[1]) * factor],
    patch: { scaleX: value('scaleX') * factor, scaleY: value('scaleY') * factor }
  }));

export function rotateAround(doc: MotionDoc, ids: readonly string[], frame: number, point: Pt, degrees: number, mode: EditMode): OpResult {
  const radians = degrees / DEG;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  return aroundEach(doc, ids, frame, mode, (pivot, value) => {
    const [dx, dy] = sub(pivot, point);
    return { to: [point[0] + dx * cos - dy * sin, point[1] + dx * sin + dy * cos], patch: { rotateZ: value('rotateZ') + degrees } };
  });
}
