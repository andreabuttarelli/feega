import type { MotionClip, MotionDoc } from './doc';
import { withAutoLayout } from './layout/resolve';
import { withoutHidden } from './organize';
import { quadOf, type Boxes, type Pt } from './scene-select';
import { flatten } from './shape/geometry';
import { baseOutline, type ShapeLook } from './shape/render';
import { pathSpace } from './shape/space';

export enum OutlineView {
  On = 'on',
  Off = 'off'
}

export type OutlinePath = { id: string; d: string };

const UNIT = { w: 1, h: 1 };
const DIGITS = 100;

const round = (n: number) => Math.round(n * DIGITS) / DIGITS;
const polygon = (points: readonly Pt[]) => `${points.map(([x, y], i) => `${i ? 'L' : 'M'}${round(x)} ${round(y)}`).join('')}Z`;

function shapeOutline(doc: MotionDoc, clip: MotionClip, frame: number): string {
  const space = pathSpace(doc, clip.id, frame);
  return baseOutline(clip.props as unknown as ShapeLook, UNIT)
    .map((contour) => polygon(flatten(contour).map(space.toFrame)))
    .join('');
}

export const flipOutline = (view: OutlineView): OutlineView => (view === OutlineView.On ? OutlineView.Off : OutlineView.On);

export function outlinePaths(doc: MotionDoc, frame: number, boxes: Boxes): OutlinePath[] {
  const laid = withAutoLayout(withoutHidden(doc));
  const onFrame = (c: MotionClip) => frame >= c.from && frame < c.from + c.durationInFrames;
  return laid.tracks
    .flatMap((t) => t.clips as MotionClip[])
    .filter(onFrame)
    .flatMap((clip) => {
      if (clip.component === 'Shape') {
        return [{ id: clip.id, d: shapeOutline(laid, clip, frame) }];
      }
      const box = boxes[clip.id];
      return box ? [{ id: clip.id, d: polygon(quadOf(laid, clip.id, frame, box)) }] : [];
    });
}
