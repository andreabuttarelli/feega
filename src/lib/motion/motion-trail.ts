import type { MotionClip } from '@feega/motion-core/motion/doc';
import { pivotOf, transformAt, type Size } from '@feega/motion-core/motion/parent';

type Pt = [number, number];

const POSITION = ['x', 'y'] as const;

export function positionSpan(clip: MotionClip): [number, number] | null {
  const frames = POSITION.flatMap((key) => (clip.keyframes[key] ?? []).map((k) => k.frame));
  const first = Math.min(...frames);
  const last = Math.max(...frames);
  return frames.length && last > first ? [first, last] : null;
}

export function positionTrail(clip: MotionClip, size: Size): Pt[] {
  const span = positionSpan(clip);
  if (!span) {
    return [];
  }
  const [px, py] = pivotOf(clip, size);
  return Array.from({ length: span[1] - span[0] + 1 }, (_, i) => {
    const at = clip.from + span[0] + i;
    return [px + transformAt(clip, 'x', at) * size.width, py + transformAt(clip, 'y', at) * size.height];
  });
}

export function onionFrames(clip: MotionClip, frame: number): number[] {
  const keys = Object.values(clip.keyframes).flatMap((track) => (track ?? []).map((k) => clip.from + k.frame));
  const before = keys.filter((f) => f < frame);
  const after = keys.filter((f) => f > frame);
  return [...(before.length ? [Math.max(...before)] : []), ...(after.length ? [Math.min(...after)] : [])];
}
