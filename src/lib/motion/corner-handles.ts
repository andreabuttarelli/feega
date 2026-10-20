import type { MotionClip, MotionDoc } from './doc';
import { boxOf } from './layout';
import { cornerAt, cornerInward } from './draw-tool';
import { apply2d, invert2d, worldAt } from './parent';
import type { Corners, Pt } from './shape/geometry';

const HANDLE_GAP = 0.08;

type Placement = { x: number; y: number; width: number; height: number };

const placementOf = (clip: MotionClip) => clip.props as Placement;
const worldOf = (doc: MotionDoc, clip: MotionClip, frame: number) => worldAt(doc, clip.id, frame, { width: doc.width, height: doc.height });

export function cornerHandleAt(doc: MotionDoc, clip: MotionClip, frame: number, index: number, radii: Corners | readonly number[]): Pt {
  const box = boxOf(placementOf(clip), doc);
  const short = Math.min(box.width, box.height);
  const [cx, cy] = cornerAt(box, index);
  const [sx, sy] = cornerInward(index);
  const reach = Math.max(radii[index] * short, HANDLE_GAP * short);
  return apply2d(worldOf(doc, clip, frame), [cx + sx * reach, cy + sy * reach]);
}

export function cornerLocalPoint(doc: MotionDoc, clip: MotionClip, frame: number, at: Pt): Pt {
  return apply2d(invert2d(worldOf(doc, clip, frame)), at);
}
