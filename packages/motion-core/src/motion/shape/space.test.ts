import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, setTransform, type OpResult } from '../timeline';
import { pathSpace } from './space';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const shape = () => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'path', path: 'M0 0L1 0L1 1Z', x: 0.5, y: 0.5, width: 0.1, height: 0.2 } }, 'pen'));

const near = (a: [number, number], b: [number, number]) => {
  expect(a[0]).toBeCloseTo(b[0], 6);
  expect(a[1]).toBeCloseTo(b[1], 6);
};

describe('path space', () => {
  it('a path point lands in its box when the clip is not transformed', () => {
    const space = pathSpace(shape(), 'pen', 0);
    near(space.toFrame([0, 0]), [864, 432]);
    near(space.toFrame([1, 1]), [1056, 648]);
  });

  it('a dragged path carries its points with it', () => {
    const moved = must(setTransform(shape(), 'pen', { x: 0.1, y: -0.1 }));
    near(pathSpace(moved, 'pen', 0).toFrame([0, 0]), [864 + 192, 432 - 108]);
  });

  it('a rotated, scaled path round-trips frame and local points', () => {
    const posed = must(setTransform(shape(), 'pen', { x: 0.05, rotateZ: 30, scale: 1.5 }));
    const space = pathSpace(posed, 'pen', 0);
    near(space.toLocal(space.toFrame([0.25, 0.75])), [0.25, 0.75]);
  });
});
