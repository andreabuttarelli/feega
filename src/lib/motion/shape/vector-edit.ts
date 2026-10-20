import { findClip, type MotionClip, type MotionDoc } from '../doc';
import { withAutoLayout } from '../layout/resolve';
import { aabb, quadOf, snapMove, type Bounds, type Guide } from '../scene-select';
import { propBoxes } from '../space';
import type { OpResult } from '../timeline';
import type { Pt } from './geometry';
import { setPath, shapePath, type ShapeParams } from './ops';
import { ShapeKind } from './schema';

const EDITABLE: ReadonlySet<string> = new Set([ShapeKind.Path, ShapeKind.Vector, ShapeKind.Polygon, ShapeKind.Star, ShapeKind.Line]);
const NEEDS_PATH: ReadonlySet<string> = new Set([ShapeKind.Polygon, ShapeKind.Star, ShapeKind.Line]);

export const canEditPoints = (clip: Pick<MotionClip, 'component' | 'props'> | null | undefined): boolean => clip?.component === 'Shape' && EDITABLE.has(String(clip.props.shape));

export function enterPointEdit(doc: MotionDoc, clip: MotionClip): OpResult {
  return NEEDS_PATH.has(String(clip.props.shape)) ? setPath(doc, clip.id, shapePath(clip.props as unknown as ShapeParams)) : { ok: true, doc };
}

export const pointBounds = (p: Pt): Bounds => ({ left: p[0], right: p[0], top: p[1], bottom: p[1] });

export function snapPoint(point: Pt, targets: Bounds[], frame: { width: number; height: number }, reach: number): { point: Pt; guides: Guide[] } {
  const { offset, guides } = snapMove(pointBounds(point), [0, 0], targets, frame, reach);
  return { point: [point[0] + offset[0], point[1] + offset[1]], guides };
}

const SNAP_SCREEN_PX = 8;

export const snapReach = (frameWidth: number, screenWidth: number): number => (SNAP_SCREEN_PX * frameWidth) / Math.max(screenWidth, 1);

export function snapTargets(doc: MotionDoc, clipId: string, frame: number): Bounds[] {
  const laid = withAutoLayout(doc);
  const boxes = propBoxes(laid);
  return Object.keys(boxes)
    .filter((id) => id !== clipId)
    .flatMap((id) => {
      const clip = findClip(laid, id)?.clip;
      return clip && frame >= clip.from && frame < clip.from + clip.durationInFrames ? [aabb(quadOf(laid, id, frame, boxes[id]))] : [];
    });
}
