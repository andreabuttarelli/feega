import { findClip, type MotionDoc } from './doc';
import { EditMode } from './edit-mode';
import type { Transform, TransformKey } from './keyframes';
import { isLocked } from './organize';
import { pivotBox, transformAt } from './parent';
import { Grip, aabb, dragPatch, quadOf, writePatch, type Bounds, type Boxes, type Pt } from './scene-select';
import { setKeyframes, setTransform, type OpResult } from './timeline';
import { tidyMoves } from './tidy';

export enum Edge {
  Left = 'left',
  Center = 'center',
  Right = 'right',
  Top = 'top',
  Middle = 'middle',
  Bottom = 'bottom'
}

export enum Axis {
  X = 'x',
  Y = 'y'
}

export const EDGES = Object.values(Edge) as [Edge, ...Edge[]];
export const AXES = Object.values(Axis) as [Axis, ...Axis[]];

const MIN_DISTRIBUTED = 3;

const fail = (error: string): OpResult => ({ ok: false, error });

export function propBoxes(doc: MotionDoc): Boxes {
  const size = { width: doc.width, height: doc.height };
  return Object.fromEntries(doc.tracks.flatMap((t) => t.clips.map((c) => [c.id, pivotBox(c.props, size)])));
}

function shifted(doc: MotionDoc, clipId: string, frame: number, patch: Transform): OpResult {
  const clip = findClip(doc, clipId)!.clip;
  let result: OpResult = { ok: true, doc };
  for (const [key, value] of Object.entries(patch) as [TransformKey, number][]) {
    if (!result.ok) {
      return result;
    }
    const track = clip.keyframes[key];
    if (!track?.length) {
      result = setTransform(result.doc, clipId, { [key]: value });
      continue;
    }
    const delta = value - transformAt(clip, key, frame);
    result = setKeyframes(result.doc, clipId, key, track.map((k) => ({ ...k, value: Number(k.value) + delta })));
  }
  return result;
}

const WRITE: Record<EditMode, (doc: MotionDoc, clipId: string, frame: number, patch: Transform) => OpResult> = {
  [EditMode.Design]: shifted,
  [EditMode.Motion]: writePatch
};

function moveOne(doc: MotionDoc, clipId: string, frame: number, by: Pt, mode: EditMode): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return fail(`no clip ${clipId}`);
  }
  const box = pivotBox(clip.props, { width: doc.width, height: doc.height });
  const { patch } = dragPatch({ doc, clipId, frame, box, grip: Grip.Move, handle: 0, from: [0, 0], to: by, shift: false, snapTargets: [], snapPx: 0 });
  return WRITE[mode](doc, clipId, frame, patch);
}

function moveEach(doc: MotionDoc, moves: [string, Pt][], frame: number, mode: EditMode): OpResult {
  const locked = moves.find(([id]) => isLocked(doc, id));
  if (locked) {
    return fail(`${locked[0]} is locked`);
  }
  return moves.reduce<OpResult>((r, [id, by]) => (r.ok ? moveOne(r.doc, id, frame, by, mode) : r), { ok: true, doc });
}

export const moveBy = (doc: MotionDoc, ids: readonly string[], frame: number, by: Pt, mode: EditMode): OpResult =>
  moveEach(
    doc,
    ids.map((id) => [id, by]),
    frame,
    mode
  );

const ALIGN: Record<Edge, { axis: Axis; at: (b: Bounds) => number }> = {
  [Edge.Left]: { axis: Axis.X, at: (b) => b.left },
  [Edge.Center]: { axis: Axis.X, at: (b) => (b.left + b.right) / 2 },
  [Edge.Right]: { axis: Axis.X, at: (b) => b.right },
  [Edge.Top]: { axis: Axis.Y, at: (b) => b.top },
  [Edge.Middle]: { axis: Axis.Y, at: (b) => (b.top + b.bottom) / 2 },
  [Edge.Bottom]: { axis: Axis.Y, at: (b) => b.bottom }
};

const along = (axis: Axis, d: number): Pt => (axis === Axis.X ? [d, 0] : [0, d]);

function boundsOf(doc: MotionDoc, ids: readonly string[], frame: number, boxes: Boxes): Map<string, Bounds> | string {
  const missing = ids.find((id) => !findClip(doc, id) || !boxes[id]);
  if (missing) {
    return `no clip ${missing} on the stage`;
  }
  return new Map(ids.map((id) => [id, aabb(quadOf(doc, id, frame, boxes[id]))]));
}

function union(all: Bounds[]): Bounds {
  return { left: Math.min(...all.map((b) => b.left)), top: Math.min(...all.map((b) => b.top)), right: Math.max(...all.map((b) => b.right)), bottom: Math.max(...all.map((b) => b.bottom)) };
}

export function alignSpace(doc: MotionDoc, ids: readonly string[], frame: number, boxes: Boxes, edge: Edge, mode: EditMode): OpResult {
  const bounds = boundsOf(doc, ids, frame, boxes);
  if (typeof bounds === 'string') {
    return fail(bounds);
  }
  const target = ids.length > 1 ? union([...bounds.values()]) : { left: 0, top: 0, right: doc.width, bottom: doc.height };
  const { axis, at } = ALIGN[edge];
  return moveEach(
    doc,
    ids.map((id) => [id, along(axis, at(target) - at(bounds.get(id)!))]),
    frame,
    mode
  );
}

const SPAN: Record<Axis, { start: (b: Bounds) => number; size: (b: Bounds) => number }> = {
  [Axis.X]: { start: (b) => b.left, size: (b) => b.right - b.left },
  [Axis.Y]: { start: (b) => b.top, size: (b) => b.bottom - b.top }
};

export function distributeSpace(doc: MotionDoc, ids: readonly string[], frame: number, boxes: Boxes, axis: Axis, mode: EditMode): OpResult {
  if (ids.length < MIN_DISTRIBUTED) {
    return fail(`distribute needs at least ${MIN_DISTRIBUTED} clips`);
  }
  const bounds = boundsOf(doc, ids, frame, boxes);
  if (typeof bounds === 'string') {
    return fail(bounds);
  }
  const { start, size } = SPAN[axis];
  const ordered = [...ids].sort((a, b) => start(bounds.get(a)!) - start(bounds.get(b)!));
  const first = bounds.get(ordered[0])!;
  const last = bounds.get(ordered[ordered.length - 1])!;
  const sizes = ordered.map((id) => size(bounds.get(id)!));
  const gap = (start(last) + size(last) - start(first) - sizes.reduce((a, b) => a + b, 0)) / (ordered.length - 1);
  const moves = ordered.map((id, i): [string, Pt] => {
    const wanted = start(first) + sizes.slice(0, i).reduce((a, b) => a + b, 0) + gap * i;
    return [id, along(axis, wanted - start(bounds.get(id)!))];
  });
  return moveEach(doc, moves, frame, mode);
}

export function tidySpace(doc: MotionDoc, ids: readonly string[], frame: number, boxes: Boxes, mode: EditMode): OpResult {
  const bounds = boundsOf(doc, ids, frame, boxes);
  if (typeof bounds === 'string') {
    return fail(bounds);
  }
  const rects = ids.map((id) => {
    const b = bounds.get(id)!;
    return { id, left: b.left, top: b.top, width: b.right - b.left, height: b.bottom - b.top };
  });
  return moveEach(
    doc,
    tidyMoves(rects).map((m): [string, Pt] => [m.id, [m.dx, m.dy]]),
    frame,
    mode
  );
}
