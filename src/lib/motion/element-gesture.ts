import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { EditMode } from './edit-mode';
import { resizeFactors, rotateAround, scaleAroundXY, snappedHandle, turnedBy } from './group-transform';
import { groupMove } from './multi-select';
import { Grip, handlesOf, type Bounds, type Guide, type Pt, type Quad } from './scene-select';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { findClip } from '@feega/motion-core/motion/doc';
import { sizeStackAround } from './layout/ops';
import type { TextMeasure } from '@feega/motion-core/motion/layout/text-extent';

export type Keys = { shift: boolean; alt: boolean; ctrl?: boolean };

export type GroupDrag = {
  doc: MotionDoc;
  ids: readonly string[];
  frame: number;
  mode: EditMode;
  grip: Grip;
  handle: number;
  from: Pt;
  to: Pt;
  box: Bounds;
  others: Bounds[];
  reach: number;
  keys: Keys;
  measure?: TextMeasure;
};

export type GroupDragged = { result: OpResult; guides: Guide[] };

const ROTATE_STEP_DEG = 15;
const SIDE_UNIT = 0.5;

export const boundsQuad = (b: Bounds): Quad => [
  [b.left, b.top],
  [b.right, b.top],
  [b.right, b.bottom],
  [b.left, b.bottom]
];

export const centreOf = (b: Bounds): Pt => [(b.left + b.right) / 2, (b.top + b.bottom) / 2];

export function outwardOf(q: Quad, corner: Pt): Pt {
  const cx = (q[0][0] + q[2][0]) / 2;
  const cy = (q[0][1] + q[2][1]) / 2;
  const length = Math.hypot(corner[0] - cx, corner[1] - cy) || 1;
  return [(corner[0] - cx) / length, (corner[1] - cy) / length];
}

export const axisLocked = ([dx, dy]: Pt): Pt => (Math.abs(dx) >= Math.abs(dy) ? [dx, 0] : [0, dy]);

export const lockedTo = (from: Pt, to: Pt): Pt => {
  const [dx, dy] = axisLocked([to[0] - from[0], to[1] - from[1]]);
  return [from[0] + dx, from[1] + dy];
};

const sizeOf = (g: GroupDrag) => ({ width: g.doc.width, height: g.doc.height });

function turned(g: GroupDrag): GroupDragged {
  const turn = turnedBy(centreOf(g.box), g.from, g.to);
  const degrees = g.keys.shift ? Math.round(turn / ROTATE_STEP_DEG) * ROTATE_STEP_DEG : turn;
  return { result: rotateAround(g.doc, g.ids, g.frame, centreOf(g.box), degrees, g.mode), guides: [] };
}

function scaled(g: GroupDrag): GroupDragged {
  const { unit, at } = handlesOf(boundsQuad(g.box))[g.handle];
  const dragged: Pt = [at[0] + g.to[0] - g.from[0], at[1] + g.to[1] - g.from[1]];
  const snapped = snappedHandle(dragged, [unit[0] !== SIDE_UNIT, unit[1] !== SIDE_UNIT], g.others, sizeOf(g), g.reach);
  const { anchor, fx, fy } = resizeFactors(g.box, unit, snapped.point, g.keys.shift, g.keys.alt);
  const stacks = g.ids.filter((id) => findClip(g.doc, id)?.clip.autoLayout);
  const rest = g.ids.filter((id) => !stacks.includes(id));
  const scaledRest = rest.length ? scaleAroundXY(g.doc, rest, g.frame, anchor, fx, fy, g.mode) : ({ ok: true, doc: g.doc } as OpResult);
  const result = stacks.reduce<OpResult>((done, id) => (done.ok ? sizeStackAround(done.doc, id, anchor, fx, fy, g.measure) : done), scaledRest);
  return { result, guides: snapped.guides };
}

function moved(g: GroupDrag): GroupDragged {
  const to = g.keys.shift ? lockedTo(g.from, g.to) : g.to;
  return groupMove({ doc: g.doc, ids: g.ids, frame: g.frame, mode: g.mode, offset: [to[0] - g.from[0], to[1] - g.from[1]], box: g.box, others: g.others, size: sizeOf(g), reach: g.reach });
}

const GROUP_GRIPS: Record<Grip, (g: GroupDrag) => GroupDragged> = {
  [Grip.Move]: moved,
  [Grip.Scale]: scaled,
  [Grip.Anchor]: scaled,
  [Grip.Rotate]: turned
};

export const groupDrag = (g: GroupDrag): GroupDragged => GROUP_GRIPS[g.grip](g);
