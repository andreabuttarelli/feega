import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { pivotBox } from '@feega/motion-core/motion/parent';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { DEFAULT_LAYOUT_ITEM } from '@feega/motion-core/motion/layout/model';
import { strokesOf } from '@feega/motion-core/motion/stroke/model';
import { keepTextSize } from '../text-fit';
import { estimatedText, type TextMeasure } from '@feega/motion-core/motion/layout/text-extent';

const SLACK_PX = 0.5;

type Size = { width: number; height: number };

export type StackFit = { doc: MotionDoc; share: Size };

const AXIS_PROPS = { x: 'width', width: 'width', y: 'height', height: 'height' } as const;

const unitOf = (size: Size) => Math.min(size.width, size.height);

function rescaled(clip: MotionClip, from: Size, to: Size): MotionClip {
  const props: Record<string, unknown> = { ...clip.props };
  for (const [key, axis] of Object.entries(AXIS_PROPS)) {
    if (typeof props[key] === 'number') {
      props[key] = ((props[key] as number) * from[axis]) / to[axis];
    }
  }
  if (props.strokes !== undefined || props.strokeKind !== undefined) {
    const factor = unitOf(from) / unitOf(to);
    props.strokes = strokesOf(clip.props).map((s) => ({ ...s, width: s.width * factor, ...(s.sides ? { sides: s.sides.map((side) => side * factor) as typeof s.sides } : {}) }));
  }
  return { ...clip, props };
}

function holdPixels(doc: MotionDoc, to: Size): MotionDoc {
  const from = { width: doc.width, height: doc.height };
  const tracks = doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => rescaled(c as MotionClip, from, to)) }));
  return keepTextSize({ ...doc, ...to, tracks } as MotionDoc, from, to);
}

const roots = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => !c.parent);

const AXES = ['width', 'height'] as const;
const AXIS_ORIGIN = { width: 'x', height: 'y' } as const;
const WHOLE = 1;
const MIDDLE = 0.5;

function filledWhereDragged(root: MotionClip, stage: Size, to: Size): MotionClip {
  const item = root.layoutItem ?? DEFAULT_LAYOUT_ITEM;
  const dragged = AXES.filter((axis) => Math.abs(to[axis] - stage[axis]) > SLACK_PX);
  const fixed = Object.fromEntries(dragged.map((axis) => [axis, item[axis] === Sizing.Hug ? Sizing.Fixed : item[axis]]));
  const filling = Object.fromEntries(dragged.flatMap((axis) => [[axis, WHOLE], [AXIS_ORIGIN[axis], MIDDLE]]));
  return { ...root, layoutItem: { ...item, ...fixed }, props: { ...root.props, ...filling } };
}

export function stackElementResized(doc: MotionDoc, to: Size): MotionDoc | null {
  const [root, ...rest] = roots(doc);
  if (!root?.autoLayout || rest.length) {
    return null;
  }
  const stage = { width: doc.width, height: doc.height };
  const sized = (c: MotionClip) => {
    const held = rescaled(c, stage, to);
    return c.id === root.id ? filledWhereDragged(held, stage, to) : held;
  };
  const tracks = doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => sized(c as MotionClip)) }));
  return { ...doc, ...to, tracks } as MotionDoc;
}

export function freeStackFit(doc: MotionDoc, measure: TextMeasure = estimatedText): StackFit | null {
  const [root, ...rest] = roots(doc);
  if (!root?.autoLayout || rest.length) {
    return null;
  }
  const stage = { width: doc.width, height: doc.height };
  const laid = withAutoLayout(doc, measure).tracks.flatMap((t) => t.clips).find((c) => c.id === root.id)!;
  const box = pivotBox(laid.props, stage);
  const size = { width: Math.round(box.left + box.width), height: Math.round(box.top + box.height) };
  if (Math.abs(size.width - stage.width) <= SLACK_PX && Math.abs(size.height - stage.height) <= SLACK_PX) {
    return null;
  }
  return { doc: holdPixels(doc, size), share: { width: size.width / stage.width, height: size.height / stage.height } };
}

const LAID_KEYS = ['x', 'y', 'width', 'height'] as const;

export function laidOutAsShown(doc: MotionDoc, measure: TextMeasure = estimatedText): MotionDoc {
  const laid = new Map(withAutoLayout(doc, measure).tracks.flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c.props]));
  const settle = (clip: MotionClip): MotionClip => {
    const props = laid.get(clip.id);
    const moved = props ? LAID_KEYS.filter((k) => typeof props[k] === 'number' && props[k] !== clip.props[k]) : [];
    return moved.length ? { ...clip, props: { ...clip.props, ...Object.fromEntries(moved.map((k) => [k, props![k]])) } } : clip;
  };
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => settle(c as MotionClip)) })) } as MotionDoc;
}
