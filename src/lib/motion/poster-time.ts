import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { prepare, restFrame } from '@feega/motion-core/motion/gpu-full/display-list';
import { readClips } from '@feega/motion-core/motion/gpu-full/dom/custom';
import { coverFrame } from '@feega/motion-core/motion/still';

const rested = new WeakMap<MotionDoc, number>();

export function restFrameOf(doc: MotionDoc): number {
  const known = rested.get(doc);
  if (known !== undefined) {
    return known;
  }
  const frame = readClips(doc).read.length ? coverFrame(doc) : restFrame(prepare(doc, FEEGA_TOKENS));
  rested.set(doc, frame);
  return frame;
}

export const posterSecond = (doc: MotionDoc): number => restFrameOf(doc) / doc.fps;
