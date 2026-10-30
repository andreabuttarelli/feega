import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { aabb, quadOf, snapMove, type Bounds, type Guide } from '../scene-select';
import { propBoxes } from '../space';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import type { Pt } from '@feega/motion-core/motion/shape/geometry';
import { setPath, shapePath, type ShapeParams } from './ops';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { pathSpace } from '@feega/motion-core/motion/shape/space';

const EDITABLE: ReadonlySet<string> = new Set(Object.values(ShapeKind));
const NEEDS_PATH: ReadonlySet<string> = new Set([ShapeKind.Rect, ShapeKind.Circle, ShapeKind.Ellipse, ShapeKind.Polygon, ShapeKind.Star, ShapeKind.Line]);

export const canEditPoints = (clip: Pick<MotionClip, 'component' | 'props'> | null | undefined): boolean => clip?.component === 'Shape' && EDITABLE.has(String(clip.props.shape));

const holdsChildren = (doc: MotionDoc, id: string): boolean => doc.tracks.some((t) => t.clips.some((c) => c.parent === id));

export const editsPoints = (doc: MotionDoc, clip: MotionClip): boolean => canEditPoints(clip) && !holdsChildren(doc, clip.id);

export function enterPointEdit(doc: MotionDoc, clip: MotionClip): OpResult {
  return NEEDS_PATH.has(String(clip.props.shape)) ? setPath(doc, clip.id, shapePath(clip.props as unknown as ShapeParams)) : { ok: true, doc };
}

export function landsOn(doc: MotionDoc, clipId: string, frame: number, at: Pt): boolean {
  const [u, v] = pathSpace(doc, clipId, frame).toLocal(at);
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
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
