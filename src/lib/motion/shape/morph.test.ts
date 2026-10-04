import { describe, expect, it } from 'vitest';
import { ellipseOutline, flatten, rectOutline, starOutline, type Outline, type Pt } from './geometry';
import { MORPH_POINTS, morphBetween, morphOutline, resample } from './morph';

const points = (o: Outline) => o.flatMap((c) => flatten(c));
const near = (a: readonly Pt[], b: readonly Pt[]) => a.every((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) < 1e-6);

describe('resample', () => {
  it('spaces points evenly along the length', () => {
    const ring = resample(rectOutline(0)[0], 8);
    expect(ring).toHaveLength(8);
    expect(ring[0]).toEqual([0, 0]);
    expect(ring[2]).toEqual([1, 0]);
  });
});

describe('morph', () => {
  it('starts on the first shape and ends on the second', () => {
    const square = rectOutline(0);
    const circle = ellipseOutline();
    expect(near(points(morphBetween(square, circle, 0, 0)), resample(square[0], MORPH_POINTS))).toBe(true);
    const end = points(morphBetween(square, circle, 1, 0));
    expect(end.every((p) => Math.abs(Math.hypot(p[0] - 0.5, p[1] - 0.5) - 0.5) < 0.01)).toBe(true);
  });

  it('aligns the start point so the middle does not twist into itself', () => {
    const star = starOutline(5, 0.5, 0);
    const rotated = starOutline(5, 0.5, 0).map((c) => ({ ...c, vertices: [...c.vertices.slice(2), ...c.vertices.slice(0, 2)] }));
    const middle = points(morphBetween(star, rotated, 0.5, 0));
    expect(near(middle, resample(star[0], MORPH_POINTS))).toBe(true);
  });

  it('the start point shift turns the correspondence by that share of the ring', () => {
    const a = morphBetween(rectOutline(0), ellipseOutline(), 1, 0);
    const b = morphBetween(rectOutline(0), ellipseOutline(), 1, 0.25);
    expect(near(points(a), points(b))).toBe(false);
  });

  it('walks a chain of shapes by a fractional position, the same every time', () => {
    const shapes = [rectOutline(0), ellipseOutline(), starOutline(5, 0.4, 0)];
    expect(points(morphOutline(shapes, 2, 0))).toEqual(points(morphBetween(shapes[1], shapes[2], 1, 0)));
    expect(points(morphOutline(shapes, 1.5, 0))).toEqual(points(morphOutline(shapes, 1.5, 0)));
    expect(points(morphOutline(shapes, 9, 0))).toEqual(points(morphOutline(shapes, 2, 0)));
  });

  it('a shape with more contours grows the extra ones out of a point', () => {
    const two: Outline = [...rectOutline(0), ...ellipseOutline({ w: 0.2, h: 0.2 })];
    const start = morphBetween(rectOutline(0), two, 0, 0);
    expect(start).toHaveLength(2);
    const dot = flatten(start[1]);
    expect(dot.every((p) => p[0] === dot[0][0] && p[1] === dot[0][1])).toBe(true);
  });
});
