import { findClip, type MotionClip, type MotionDoc } from '../doc';
import { setCanvas, type CanvasSize, type OpResult } from '../timeline';
import { Horizontal, Vertical, constraintsSchema, type Constraints } from './model';

export { Horizontal, Vertical, type Constraints };

type Span = { start: number; length: number };
type Rule = (span: Span, from: number, to: number) => Span;

const pinStart: Rule = (s) => s;
const pinEnd: Rule = (s, from, to) => ({ start: to - (from - s.start), length: s.length });
const stretch: Rule = (s, from, to) => ({ start: s.start, length: to - s.start - (from - s.start - s.length) });
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

function constrained(clip: MotionClip, from: CanvasSize, to: CanvasSize): MotionClip {
  if (!clip.constraints || clip.parent || !placed(clip.props)) {
    return clip;
  }
  const p = clip.props;
  const across = HORIZONTAL[clip.constraints.horizontal]({ start: (p.x - p.width / 2) * from.width, length: p.width * from.width }, from.width, to.width);
  const down = VERTICAL[clip.constraints.vertical]({ start: (p.y - p.height / 2) * from.height, length: p.height * from.height }, from.height, to.height);
  return {
    ...clip,
    props: { ...p, x: (across.start + across.length / 2) / to.width, y: (down.start + down.length / 2) / to.height, width: across.length / to.width, height: down.length / to.height }
  };
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
