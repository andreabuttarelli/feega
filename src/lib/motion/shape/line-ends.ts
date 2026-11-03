import type { MotionClip } from '@feega/motion-core/motion/doc';
import { parsePath, type Pt } from '@feega/motion-core/motion/shape/geometry';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { isCorner } from './pen';

export type LineEnds = [Pt, Pt];

const LINE_POINTS = 2;

export function lineEnds(clip: Pick<MotionClip, 'component' | 'props'>): LineEnds | null {
  if (clip.component !== 'Shape' || clip.props.shape !== ShapeKind.Path) {
    return null;
  }

  const outline = parsePath(String(clip.props.path ?? ''));
  if (typeof outline === 'string' || outline.length !== 1) {
    return null;
  }

  const [only] = outline;
  if (only.closed || only.vertices.length !== LINE_POINTS || !only.vertices.every(isCorner)) {
    return null;
  }
  return [only.vertices[0].p, only.vertices[1].p];
}
