import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { prepare, restFrame } from '@feega/motion-core/motion/gpu-full/display-list';

const rested = new WeakMap<MotionDoc, number>();

export function restFrameOf(doc: MotionDoc): number {
  const known = rested.get(doc);
  if (known !== undefined) {
    return known;
  }
  const frame = restFrame(prepare(doc, FEEGA_TOKENS));
  rested.set(doc, frame);
  return frame;
}

export const posterSecond = (doc: MotionDoc): number => restFrameOf(doc) / doc.fps;
