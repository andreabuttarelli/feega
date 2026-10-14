import { findClip, type MotionClip, type MotionDoc } from './doc';
import type { Box } from './layout';
import type { Transform, TransformKey } from './keyframes';
import { IDENTITY, apply2d, decomposeLocal, invert2d, localAt, pivotBox, pivotOf, transformAt, worldAt, type Affine, type Size } from './parent';
import { setKeyframe, setTransform, type OpResult } from './timeline';
import { propsOwner, toShown, unitOf } from './units';
import type { ComponentId } from './components';

export type Pt = [number, number];
export type Quad = [Pt, Pt, Pt, Pt];
export type Boxes = Record<string, Box>;
export type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
export type Guide = { axis: 'x' | 'y'; at: number };

export enum PickMode {
  Top = 'top',
  Beneath = 'beneath'
}

export enum Grip {
  Move = 'move',
  Scale = 'scale',
  Rotate = 'rotate',
  Anchor = 'anchor'
}

export type Handle = { at: Pt; unit: Pt };

const ROTATE_STEP = 15;
const DEG = 180 / Math.PI;
const TINY = 1e-6;
const READOUT_PRECISION = 100;

const UNIT_CORNERS: Pt[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1]
];

const UNIT_SIDES: Pt[] = [
  [0.5, 0],
  [0.5, 1],
  [0, 0.5],
  [1, 0.5]
];

const sizeOf = (doc: MotionDoc): Size => ({
  width: doc.width,
  height: doc.height
});
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const linear = (m: Affine): Affine => [m[0], m[1], m[2], m[3], 0, 0];

function boxPoint(box: Box, [u, v]: Pt): Pt {
  return [box.left + u * box.width, box.top + v * box.height];
}

export const remeasured = (previous: Boxes, measured: Boxes): Boxes => (Object.keys(measured).length ? measured : previous);

export function quadOf(doc: MotionDoc, clipId: string, frame: number, box: Box): Quad {
  const world = worldAt(doc, clipId, frame, sizeOf(doc));
  return UNIT_CORNERS.map((c) => apply2d(world, boxPoint(box, c))) as Quad;
}

export function aabb(quad: Quad): Bounds {
  const xs = quad.map((p) => p[0]);
  const ys = quad.map((p) => p[1]);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys)
  };
}

export function handlesOf(quad: Quad): Handle[] {
  const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const at = ([u, v]: Pt) => lerp(lerp(quad[0], quad[1], u), lerp(quad[3], quad[2], u), v);
  return [...UNIT_CORNERS, ...UNIT_SIDES].map((unit) => ({
    at: at(unit),
    unit
  }));
}

function inside(quad: Quad, p: Pt): boolean {
  const signs = quad.map((a, i) => {
    const b = quad[(i + 1) % 4];
    return Math.sign((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  });
  return signs.every((s) => s >= 0) || signs.every((s) => s <= 0);
}

const live = (clip: MotionClip, frame: number) => frame >= clip.from && frame < clip.from + clip.durationInFrames;

export function stackAt(doc: MotionDoc, frame: number, boxes: Boxes, p: Pt): string[] {
  return doc.tracks
    .flatMap((t) => [...(t.clips as MotionClip[])].reverse())
    .filter((c) => live(c, frame) && boxes[c.id] && inside(quadOf(doc, c.id, frame, boxes[c.id]), p))
    .map((c) => c.id);
}

export enum Modifier {
  None = 'none',
  Alt = 'alt'
}

const SAME_SPOT_PX = 12;

export function pickModeAt(previous: Pt | null, at: Pt, modifier: Modifier): PickMode {
  if (modifier === Modifier.Alt) {
    return PickMode.Beneath;
  }
  const again = previous && Math.hypot(at[0] - previous[0], at[1] - previous[1]) < SAME_SPOT_PX;
  return again ? PickMode.Beneath : PickMode.Top;
}

export function pick(stack: string[], current: string | null, mode: PickMode): string | null {
  if (!stack.length) {
    return null;
  }
  const at = current ? stack.indexOf(current) : -1;
  if (mode === PickMode.Top || at < 0) {
    return stack[0];
  }
  return stack[(at + 1) % stack.length];
}

type Lines = { x: number[]; y: number[] };

function linesOf(b: Bounds): Lines {
  return {
    x: [b.left, (b.left + b.right) / 2, b.right],
    y: [b.top, (b.top + b.bottom) / 2, b.bottom]
  };
}

function nearest(own: number[], targets: number[], reach: number): { shift: number; at: number } | null {
  let best: { shift: number; at: number } | null = null;
  for (const a of own) {
    for (const t of targets) {
      const shift = t - a;
      if (Math.abs(shift) <= reach && (!best || Math.abs(shift) < Math.abs(best.shift))) {
        best = { shift, at: t };
      }
    }
  }
  return best;
}

export function snapMove(moving: Bounds, offset: Pt, others: Bounds[], frame: Size, reach: number): { offset: Pt; guides: Guide[] } {
  const moved = linesOf({
    left: moving.left + offset[0],
    right: moving.right + offset[0],
    top: moving.top + offset[1],
    bottom: moving.bottom + offset[1]
  });
  const targets = [{ left: 0, top: 0, right: frame.width, bottom: frame.height }, ...others].map(linesOf);
  const sx = nearest(
    moved.x,
    targets.flatMap((t) => t.x),
    reach
  );
  const sy = nearest(
    moved.y,
    targets.flatMap((t) => t.y),
    reach
  );
  const guides: Guide[] = [...(sx ? [{ axis: 'x' as const, at: sx.at }] : []), ...(sy ? [{ axis: 'y' as const, at: sy.at }] : [])];
  return {
    offset: [offset[0] + (sx?.shift ?? 0), offset[1] + (sy?.shift ?? 0)],
    guides
  };
}

export type DragInput = {
  doc: MotionDoc;
  clipId: string;
  frame: number;
  box: Box;
  grip: Grip;
  handle: number;
  from: Pt;
  to: Pt;
  shift: boolean;
  snapTargets: Bounds[];
  snapPx: number;
};

export type DragResult = { patch: Transform; guides: Guide[] };

type Context = DragInput & {
  clip: MotionClip;
  size: Size;
  world: Affine;
  anchor: Pt;
  value: (key: TransformKey) => number;
};

function parentWorld(c: Context): Affine {
  return c.clip.parent ? worldAt(c.doc, c.clip.parent, c.frame, c.size) : IDENTITY;
}

function moved(c: Context): DragResult {
  const raw = sub(c.to, c.from);
  const snapped = c.snapPx > 0 ? snapMove(aabb(quadOf(c.doc, c.clipId, c.frame, c.box)), raw, c.snapTargets, c.size, c.snapPx) : { offset: raw, guides: [] };
  const [dx, dy] = apply2d(invert2d(linear(parentWorld(c))), snapped.offset);
  return {
    patch: {
      x: c.value('x') + dx / c.size.width,
      y: c.value('y') + dy / c.size.height
    },
    guides: snapped.guides
  };
}

function ratio(now: Pt, start: Pt, axis: Pt): number {
  const base = dot(start, axis);
  return Math.abs(base) < TINY ? 1 : dot(now, axis) / base;
}

const FRAME_BOUNDS = (size: Size): Bounds => ({ left: 0, top: 0, right: size.width, bottom: size.height });

function snapHandle(c: Context): { to: Pt; guides: Guide[] } {
  if (c.snapPx <= 0) {
    return { to: c.to, guides: [] };
  }
  const handle = handlesOf(quadOf(c.doc, c.clipId, c.frame, c.box))[c.handle];
  const [hx, hy] = [c.to[0] + handle.at[0] - c.from[0], c.to[1] + handle.at[1] - c.from[1]];
  const targets = [FRAME_BOUNDS(c.size), ...c.snapTargets].map(linesOf);
  const sx = handle.unit[0] === 0.5 ? null : nearest([hx], targets.flatMap((t) => t.x), c.snapPx);
  const sy = handle.unit[1] === 0.5 ? null : nearest([hy], targets.flatMap((t) => t.y), c.snapPx);
  return {
    to: [c.to[0] + (sx?.shift ?? 0), c.to[1] + (sy?.shift ?? 0)],
    guides: [...(sx ? [{ axis: 'x' as const, at: sx.at }] : []), ...(sy ? [{ axis: 'y' as const, at: sy.at }] : [])]
  };
}

function scaled(c: Context): DragResult {
  const snapped = snapHandle(c);
  return { patch: scalePatch({ ...c, to: snapped.to }), guides: snapped.guides };
}

function scalePatch(c: Context): Transform {
  const unit = handlesOf(UNIT_CORNERS as Quad)[c.handle].unit;
  const [q0, q1, , q3] = UNIT_CORNERS.map((p) => apply2d(c.world, boxPoint(c.box, p)));
  const u = sub(q1, q0);
  const v = sub(q3, q0);
  const start = sub(c.from, c.anchor);
  const now = sub(c.to, c.anchor);
  const alongU = unit[0] !== 0.5;
  const alongV = unit[1] !== 0.5;
  const uniform = ratio(now, start, start);
  const fu = c.shift ? uniform : ratio(now, start, u);
  const fv = c.shift ? uniform : ratio(now, start, v);
  const patch: Transform = {};
  if (alongU || c.shift) {
    patch.scaleX = c.value('scaleX') * fu;
  }
  if (alongV || c.shift) {
    patch.scaleY = c.value('scaleY') * fv;
  }
  return patch;
}

function rotated(c: Context): DragResult {
  const angle = (p: Pt) => Math.atan2(p[1] - c.anchor[1], p[0] - c.anchor[0]) * DEG;
  const turned = c.value('rotateZ') + angle(c.to) - angle(c.from);
  return {
    patch: {
      rotateZ: c.shift ? Math.round(turned / ROTATE_STEP) * ROTATE_STEP : turned
    },
    guides: []
  };
}

function anchored(c: Context): DragResult {
  const pivot = apply2d(invert2d(c.world), c.to);
  const box = pivotBox(c.clip.props, c.size);
  const pose = decomposeLocal(localAt(c.clip, c.frame, c.size), pivot);
  const fraction = (n: number, span: number) => (span > TINY ? n / span : 0.5);
  return {
    patch: {
      anchorX: fraction(pivot[0] - box.left, box.width),
      anchorY: fraction(pivot[1] - box.top, box.height),
      x: pose.x / c.size.width,
      y: pose.y / c.size.height
    },
    guides: []
  };
}

const GRIPS: Record<Grip, (c: Context) => DragResult> = {
  [Grip.Move]: moved,
  [Grip.Scale]: scaled,
  [Grip.Rotate]: rotated,
  [Grip.Anchor]: anchored
};

export function anchorOf(doc: MotionDoc, clipId: string, frame: number): Pt {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return [0, 0];
  }
  const size = sizeOf(doc);
  const parent = clip.parent ? worldAt(doc, clip.parent, frame, size) : IDENTITY;
  const local = localAt(clip, frame, size);
  return apply2d(parent, apply2d(local, pivotOf(clip, size)));
}

export function dragPatch(input: DragInput): DragResult {
  const clip = findClip(input.doc, input.clipId)?.clip;
  if (!clip) {
    return { patch: {}, guides: [] };
  }
  const size = sizeOf(input.doc);
  const context: Context = {
    ...input,
    clip,
    size,
    world: worldAt(input.doc, input.clipId, input.frame, size),
    anchor: anchorOf(input.doc, input.clipId, input.frame),
    value: (key) => transformAt(clip, key, input.frame)
  };
  return GRIPS[input.grip](context);
}

export function writePatch(doc: MotionDoc, clipId: string, frame: number, patch: Transform): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return { ok: false, error: `no clip ${clipId}` };
  }
  let result: OpResult = { ok: true, doc };
  for (const [key, value] of Object.entries(patch) as [TransformKey, number][]) {
    if (!result.ok) {
      return result;
    }
    result = clip.keyframes[key]?.length ? setKeyframe(result.doc, clipId, key, frame - clip.from, value) : setTransform(result.doc, clipId, { [key]: value });
  }
  return result;
}

export function readout(component: ComponentId, patch: Transform, frame: Size): string {
  const owner = propsOwner(component);
  return Object.entries(patch)
    .map(([key, value]) => `${key} ${Math.round(toShown(owner, key, value as number, frame) * READOUT_PRECISION) / READOUT_PRECISION}${unitOf(owner, key) ? ` ${unitOf(owner, key)}` : ''}`)
    .join(' · ');
}

export type Gap = { axis: 'x' | 'y'; from: number; to: number; at: number };

const overlaps = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) > Math.max(a0, b0);

export function spacing(moving: Bounds, others: Bounds[], frame: Size): Gap[] {
  const midX = (moving.left + moving.right) / 2;
  const midY = (moving.top + moving.bottom) / 2;
  const facingX = others.filter((o) => overlaps(o.top, o.bottom, moving.top, moving.bottom));
  const facingY = others.filter((o) => overlaps(o.left, o.right, moving.left, moving.right));
  const left = Math.max(0, ...facingX.filter((o) => o.right <= moving.left).map((o) => o.right));
  const right = Math.min(frame.width, ...facingX.filter((o) => o.left >= moving.right).map((o) => o.left));
  const top = Math.max(0, ...facingY.filter((o) => o.bottom <= moving.top).map((o) => o.bottom));
  const bottom = Math.min(frame.height, ...facingY.filter((o) => o.top >= moving.bottom).map((o) => o.top));
  return [
    { axis: 'x' as const, from: left, to: moving.left, at: midY },
    { axis: 'x' as const, from: moving.right, to: right, at: midY },
    { axis: 'y' as const, from: top, to: moving.top, at: midX },
    { axis: 'y' as const, from: moving.bottom, to: bottom, at: midX }
  ].filter((g) => g.to > g.from);
}
