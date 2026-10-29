import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { EditMode } from '$lib/motion/edit-mode';
import { groupDrag, lockedTo, type Keys } from '$lib/motion/element-gesture';
import { guideSnapBounds } from '$lib/motion/layout-guides/guides';
import { measureGaps } from '$lib/motion/measure-gaps';
import { unionBounds } from '$lib/motion/multi-select';
import { Grip, aabb, dragPatch, quadOf, spacing, type Bounds, type Boxes, type Gap, type Guide, type Pt } from '$lib/motion/scene-select';
import { moveBy, writeTransform } from '$lib/motion/space';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { arrowStep, stackPlaced, stepInStack } from '$lib/motion/layout/ops';

export enum SelectionKind {
  Element = 'element',
  Member = 'member',
  Group = 'group'
}

export const GRIP_SUMMARY: Record<Grip, string> = {
  [Grip.Move]: 'Moved an element',
  [Grip.Scale]: 'Resized an element',
  [Grip.Rotate]: 'Rotated an element',
  [Grip.Anchor]: 'Moved the anchor point'
};

export enum SnapMode {
  Guides = 'guides',
  Pixels = 'pixels',
  Off = 'off'
}

export type Drag = { doc: MotionDoc; ids: readonly string[]; frame: number; boxes: Boxes; grip: Grip; handle: number; from: Pt; to: Pt; keys: Keys; reach: number; snap?: SnapMode; mode: EditMode };
export type Dragged = { result: OpResult; guides: Guide[]; gaps: Gap[] };

const boundsOf = (doc: MotionDoc, id: string, frame: number, boxes: Boxes): Bounds => aabb(quadOf(doc, id, frame, boxes[id]));

const present = (doc: MotionDoc, boxes: Boxes) => (id: string) => Boolean(findClip(doc, id) && boxes[id]);

function othersOf(d: Drag): Bounds[] {
  return Object.keys(d.boxes)
    .filter((id) => !d.ids.includes(id) && findClip(d.doc, id))
    .map((id) => boundsOf(d.doc, id, d.frame, d.boxes));
}

const TILT_EPSILON = 1e-6;

function tilted(d: Drag): boolean {
  const [a, b] = quadOf(d.doc, d.ids[0], d.frame, d.boxes[d.ids[0]]);
  return Math.abs(b[1] - a[1]) > TILT_EPSILON;
}

const asGroup = (d: Drag) => d.ids.length > 1 || (d.grip === Grip.Scale && !tilted(d));

const snapTargets = (d: Drag, others: Bounds[]): Bounds[] => ((d.snap ?? SnapMode.Guides) === SnapMode.Off ? [] : [...others, ...guideSnapBounds(d.doc)]);

function dragGroup(d: Drag, others: Bounds[]): Dragged {
  const box = unionBounds(d.ids.map((id) => boundsOf(d.doc, id, d.frame, d.boxes)));
  return { ...groupDrag({ ...d, box, others: snapTargets(d, others) }), gaps: [] };
}

function dragOne(d: Drag, others: Bounds[]): Dragged {
  const clipId = d.ids[0];
  const to = d.keys.shift && d.grip === Grip.Move ? lockedTo(d.from, d.to) : d.to;
  const { patch, guides } = dragPatch({ doc: d.doc, clipId, frame: d.frame, box: d.boxes[clipId], grip: d.grip, handle: d.handle, from: d.from, to, shift: d.keys.shift, snapTargets: snapTargets(d, others), snapPx: d.reach });
  const result = writeTransform(d.mode, d.doc, clipId, d.frame, patch);
  if (!result.ok || d.grip === Grip.Rotate) {
    return { result, guides, gaps: [] };
  }
  return { result, guides, gaps: spacing(boundsOf(result.doc, clipId, d.frame, d.boxes), others, { width: d.doc.width, height: d.doc.height }) };
}

function onWholePixels(d: Drag, dragged: Dragged): Dragged {
  if (!dragged.result.ok || d.snap !== SnapMode.Pixels || d.grip !== Grip.Move) {
    return dragged;
  }
  const { doc } = dragged.result;
  const box = unionBounds(d.ids.map((id) => boundsOf(doc, id, d.frame, d.boxes)));
  const aligned = moveBy(doc, d.ids, d.frame, [Math.round(box.left) - box.left, Math.round(box.top) - box.top], d.mode);
  return aligned.ok ? { ...dragged, result: aligned } : dragged;
}

const lockedRatio = (d: Drag): boolean => d.ids.every((id) => findClip(d.doc, id)?.clip.lockRatio);

function withLock(d: Drag): Drag {
  const keep = d.grip === Grip.Scale && (d.keys.shift || lockedRatio(d)) && !d.keys.ctrl;
  return { ...d, keys: { ...d.keys, shift: d.grip === Grip.Scale ? keep : d.keys.shift } };
}

export function dragClips(d: Drag): Dragged {
  const missing = d.ids.find((id) => !present(d.doc, d.boxes)(id));
  if (missing || !d.ids.length) {
    return { result: { ok: false, error: `no clip ${missing ?? ''}` }, guides: [], gaps: [] };
  }
  const at = d.snap === SnapMode.Off ? { ...withLock(d), reach: 0 } : withLock(d);
  const others = othersOf(at);
  return onWholePixels(at, asGroup(at) ? dragGroup(at, others) : dragOne(at, others));
}

export function nudgeClips(doc: MotionDoc, ids: readonly string[], frame: number, by: Pt, mode: EditMode): OpResult {
  const stacked = ids.filter((id) => stackPlaced(doc, id));
  if (!stacked.length) {
    return moveBy(doc, ids, frame, by, mode);
  }
  const step = ids.length === 1 ? arrowStep(doc, ids[0], by) : 0;
  return step ? stepInStack(doc, ids[0], step) : { ok: false, error: 'a stack places its children: arrows reorder one child along the stack' };
}

export function measuredGaps(doc: MotionDoc, frame: number, boxes: Boxes, picks: readonly string[], hovered: string): Gap[] {
  const shown = picks.filter(present(doc, boxes));
  if (!shown.length || picks.includes(hovered) || !present(doc, boxes)(hovered)) {
    return [];
  }
  return measureGaps(unionBounds(shown.map((id) => boundsOf(doc, id, frame, boxes))), boundsOf(doc, hovered, frame, boxes));
}
