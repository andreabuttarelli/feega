import { FEEGA_TOKENS } from './brand';
import type { MotionDoc } from './doc';
import { prepare, restFrame } from './gpu-full/display-list';

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
