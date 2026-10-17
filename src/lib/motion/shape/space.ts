import { findClip, type MotionDoc } from '../doc';
import { boxOf } from '../layout';
import { withAutoLayout } from '../layout/resolve';
import { IDENTITY, apply2d, invert2d, worldAt } from '../parent';
import type { Pt } from './geometry';

export type PathSpace = { toFrame: (p: Pt) => Pt; toLocal: (p: Pt) => Pt };

export function pathSpace(doc: MotionDoc, clipId: string, frame: number): PathSpace {
  const laid = withAutoLayout(doc);
  const clip = findClip(laid, clipId)?.clip;
  const box = boxOf((clip?.props ?? { x: 0.5, y: 0.5, width: 1, height: 1 }) as { x: number; y: number; width: number; height: number }, doc);
  const world = clip ? worldAt(laid, clipId, frame, doc) : IDENTITY;
  const back = invert2d(world);
  return {
    toFrame: (p) => apply2d(world, [box.left + p[0] * box.width, box.top + p[1] * box.height]),
    toLocal: (p) => {
      const [x, y] = apply2d(back, [p[0], p[1]]);
      return [(x - box.left) / box.width, (y - box.top) / box.height];
    }
  };
}
