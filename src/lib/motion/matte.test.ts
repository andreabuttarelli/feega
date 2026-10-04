import { describe, expect, it } from 'vitest';
import { COMPONENTS } from './components';
import type { MotionClip } from './doc';
import { MaskKind, Matte } from './mask';
import { matteMask } from './matte';

const shape = (props: Record<string, unknown>) => ({ id: 'm', component: 'Shape', props: COMPONENTS.Shape.schema.parse(props) }) as unknown as MotionClip;

describe('a shape used as a matte', () => {
  it('a rectangle stays a rectangle mask', () => {
    expect(matteMask(shape({ shape: 'rect' }), Matte.Alpha)?.kind).toBe(MaskKind.Rect);
  });

  it('a star or a path becomes a polygon mask that follows its outline', () => {
    const star = matteMask(shape({ shape: 'star', points: 5, x: 0.4, width: 0.3, height: 0.3 }), Matte.Alpha)!;
    expect(star.kind).toBe(MaskKind.Polygon);
    expect(star.x).toBe(0.4);
    expect(star.points.length).toBeGreaterThanOrEqual(10);
    expect(star.points[0]).toEqual([0.5, 0]);
    const path = matteMask(shape({ shape: 'path', path: 'M0 0L1 0L0 1Z' }), Matte.Alpha)!;
    expect(path.kind).toBe(MaskKind.Polygon);
  });
});
