import { describe, expect, it } from 'vitest';
import { Op } from './face';
import { quadraticPath } from './quadratic';

const pt = (x: number, y: number, onCurve = true, endContour = false) => ({ x, y, onCurve, endContour });

describe('quadraticPath', () => {
  it('draws on-curve points as lines and closes each contour', () => {
    const square = [pt(0, 0), pt(10, 0), pt(10, 10), pt(0, 10, true, true)];

    expect(quadraticPath(square).map((c) => c.op)).toEqual([Op.Move, Op.Line, Op.Line, Op.Line, Op.Close]);
  });

  it('puts the implied on-curve point between two off-curve points', () => {
    const blob = [pt(0, 0), pt(10, 0, false), pt(10, 10, false), pt(0, 10, true, true)];

    expect(quadraticPath(blob).slice(1, 3)).toEqual([
      { op: Op.Quad, at: [10, 0, 10, 5] },
      { op: Op.Quad, at: [10, 10, 0, 10] }
    ]);
  });

  it('starts between the ends when a contour has no on-curve point', () => {
    const ring = [pt(0, 0, false), pt(10, 0, false), pt(10, 10, false), pt(0, 10, false, true)];

    expect(quadraticPath(ring)[0]).toEqual({ op: Op.Move, at: [0, 5] });
    expect(quadraticPath(ring).filter((c) => c.op === Op.Quad)).toHaveLength(4);
  });
});
