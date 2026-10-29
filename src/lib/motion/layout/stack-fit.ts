import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { pivotBox } from '@feega/motion-core/motion/parent';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { strokesOf } from '@feega/motion-core/motion/stroke/model';
import { keepTextSize } from '../text-fit';

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

export function freeStackFit(doc: MotionDoc): StackFit | null {
  const [root, ...rest] = roots(doc);
  if (!root?.autoLayout || rest.length) {
    return null;
  }
  const stage = { width: doc.width, height: doc.height };
  const laid = withAutoLayout(doc).tracks.flatMap((t) => t.clips).find((c) => c.id === root.id)!;
  const box = pivotBox(laid.props, stage);
  const size = { width: Math.round(box.left + box.width), height: Math.round(box.top + box.height) };
  if (Math.abs(size.width - stage.width) <= SLACK_PX && Math.abs(size.height - stage.height) <= SLACK_PX) {
    return null;
  }
  return { doc: holdPixels(doc, size), share: { width: size.width / stage.width, height: size.height / stage.height } };
}
