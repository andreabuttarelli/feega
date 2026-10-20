import { findClip, type MotionClip, type MotionDoc } from '../doc';
import { setCanvas, type CanvasSize, type OpResult } from '../timeline';
import { Horizontal, Vertical, constraintsSchema, type Constraints } from './model';

export { Horizontal, Vertical, type Constraints };

type Span = { start: number; length: number };
type Rule = (span: Span, from: number, to: number) => Span;

const pinStart: Rule = (s) => s;
const pinEnd: Rule = (s, from, to) => ({ start: to - (from - s.start), length: s.length });
const stretch: Rule = (s, from, to) => ({ start: s.start, length: Math.max(0, s.length + to - from) });
const centre: Rule = (s, from, to) => ({ start: s.start + (to - from) / 2, length: s.length });
const scale: Rule = (s, from, to) => ({ start: (s.start / from) * to, length: (s.length / from) * to });

const HORIZONTAL: Record<Horizontal, Rule> = {
  [Horizontal.Left]: pinStart,
  [Horizontal.Right]: pinEnd,
  [Horizontal.LeftRight]: stretch,
  [Horizontal.Center]: centre,
  [Horizontal.Scale]: scale
};

const VERTICAL: Record<Vertical, Rule> = {
  [Vertical.Top]: pinStart,
  [Vertical.Bottom]: pinEnd,
  [Vertical.TopBottom]: stretch,
  [Vertical.Center]: centre,
  [Vertical.Scale]: scale
};

type Placed = { x: number; y: number; width: number; height: number };

const placed = (props: Record<string, unknown>): props is Record<string, unknown> & Placed => ['x', 'y', 'width', 'height'].every((k) => typeof props[k] === 'number');

type Axis = 'x' | 'y';

const keepsPixels = (rule: Rule): boolean => rule !== scale;

function offsetKept(clip: MotionClip, axis: Axis, ratio: number): MotionClip {
  const own = clip.transform[axis];
  const track = clip.keyframes[axis];
  return {
    ...clip,
    transform: own === undefined ? clip.transform : { ...clip.transform, [axis]: own * ratio },
    keyframes: track ? { ...clip.keyframes, [axis]: track.map((k) => ({ ...k, value: Number(k.value) * ratio })) } : clip.keyframes
  };
}

function constrained(clip: MotionClip, from: CanvasSize, to: CanvasSize): MotionClip {
  if (!clip.constraints || clip.parent || !placed(clip.props)) {
    return clip;
  }
  const p = clip.props;
  const across = HORIZONTAL[clip.constraints.horizontal];
  const down = VERTICAL[clip.constraints.vertical];
  const wide = across({ start: (p.x - p.width / 2) * from.width, length: p.width * from.width }, from.width, to.width);
  const high = down({ start: (p.y - p.height / 2) * from.height, length: p.height * from.height }, from.height, to.height);
  const moved = { ...clip, props: { ...p, x: (wide.start + wide.length / 2) / to.width, y: (high.start + high.length / 2) / to.height, width: wide.length / to.width, height: high.length / to.height } };
  const horizontally = keepsPixels(across) ? offsetKept(moved, 'x', from.width / to.width) : moved;
  return keepsPixels(down) ? offsetKept(horizontally, 'y', from.height / to.height) : horizontally;
}

export function withConstraints(before: MotionDoc, sized: OpResult): OpResult {
  if (!sized.ok) {
    return sized;
  }
  const to = { width: sized.doc.width, height: sized.doc.height };
  return { ok: true, doc: { ...sized.doc, tracks: sized.doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => constrained(c as MotionClip, before, to)) })) } };
}

export const resizeFrame = (doc: MotionDoc, size: CanvasSize): OpResult => withConstraints(doc, setCanvas(doc, { size }));

export function setConstraints(doc: MotionDoc, ids: readonly string[], patch: Partial<Constraints>): OpResult {
  const missing = ids.find((id) => !findClip(doc, id));
  if (missing) {
    return { ok: false, error: `no clip ${missing}` };
  }
  const chosen = new Set(ids);
  const write = (clip: MotionClip): MotionClip => (chosen.has(clip.id) ? { ...clip, constraints: constraintsSchema.parse({ ...clip.constraints, ...patch }) } : clip);
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => write(c as MotionClip)) })) } };
}
