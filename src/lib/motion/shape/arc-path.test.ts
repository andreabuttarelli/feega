import { describe, expect, it } from 'vitest';
import { flatten, parsePath, type Outline } from '@feega/motion-core/motion/shape/geometry';

const outline = (d: string): Outline => {
  const parsed = parsePath(d);
  if (typeof parsed === 'string') {
    throw new Error(parsed);
  }
  return parsed;
};

const extent = (o: Outline) => {
  const points = o.flatMap(flatten);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
};

describe('arcs in path data', () => {
  it('bends a sweeping arc over the top, the way the browser draws it', () => {
    const e = extent(outline('M0 0 A10 10 0 0 1 20 0'));

    expect(e.top).toBeCloseTo(-10, 1);
    expect(e.bottom).toBeCloseTo(0, 5);
    expect(e.right).toBeCloseTo(20, 5);
  });

  it('draws a circle out of two relative arcs, and a ring with its hole', () => {
    const ring = outline('M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zm0 5a5 5 0 1 1 0 10a5 5 0 1 1 0-10z');

    expect(ring).toHaveLength(2);
    expect(extent(ring)).toMatchObject({ left: expect.closeTo(2, 1), right: expect.closeTo(22, 1), top: expect.closeTo(2, 5), bottom: expect.closeTo(22, 5) });
  });

  it('grows radii too small to reach the end point, as SVG does', () => {
    expect(extent(outline('M0,0 L162,0 A1,1 0 0 1 0,162 Z')).right).toBeCloseTo(81 + 81 * Math.SQRT2, 0);
  });

  it('reads flags written without spaces', () => {
    expect(extent(outline('M0 0a10 10 0 0120 0')).top).toBeCloseTo(-10, 1);
  });
});
