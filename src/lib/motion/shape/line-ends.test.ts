import { describe, expect, it } from 'vitest';
import type { MotionClip } from '@feega/motion-core/motion/doc';
import { lineEnds } from './line-ends';

const shape = (props: Record<string, unknown>) => ({ id: 'l', component: 'Shape', props }) as unknown as MotionClip;

describe('a straight line', () => {
  it('is an open path of two corner points, and its ends are those points', () => {
    expect(lineEnds(shape({ shape: 'path', path: 'M 0 0 L 100 40' }))).toEqual([
      [0, 0],
      [100, 40]
    ]);
  });

  it('is not a closed path, a curve, a polyline or another shape', () => {
    expect(lineEnds(shape({ shape: 'path', path: 'M 0 0 L 100 40 Z' }))).toBeNull();
    expect(lineEnds(shape({ shape: 'path', path: 'M 0 0 C 10 10 90 30 100 40' }))).toBeNull();
    expect(lineEnds(shape({ shape: 'path', path: 'M 0 0 L 100 40 L 50 90' }))).toBeNull();
    expect(lineEnds(shape({ shape: 'rect' }))).toBeNull();
  });
});
