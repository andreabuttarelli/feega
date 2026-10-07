import { describe, expect, it } from 'vitest';
import { contourLength, ellipseOutline, flatten, parsePath, pathData, polygonOutline, rectOutline, starOutline, trimContour } from './geometry';

const close = (a: number, b: number, digits = 3) => expect(a).toBeCloseTo(b, digits);

describe('path data', () => {
  it('reads absolute and relative commands into contours with handles', () => {
    const outline = parsePath('M0 0 L1 0 l0 1 H0 Z M0.2 0.2 C0.3 0.1 0.4 0.1 0.5 0.2');
    if (typeof outline === 'string') {
      throw new Error(outline);
    }
    expect(outline).toHaveLength(2);
    expect(outline[0].closed).toBe(true);
    expect(outline[0].vertices.map((v) => v.p)).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ]);
    expect(outline[1].vertices[0].out).toEqual([0.3, 0.1]);
    expect(outline[1].vertices[1].in).toEqual([0.4, 0.1]);
  });

  it('turns quadratic and smooth curves into cubics', () => {
    const outline = parsePath('M0 0 Q0.5 1 1 0 T2 0');
    if (typeof outline === 'string') {
      throw new Error(outline);
    }
    const [a, b] = outline[0].vertices;
    close(a.out[0], 1 / 3);
    close(a.out[1], 2 / 3);
    close(b.in[1], 2 / 3);
    expect(outline[0].vertices).toHaveLength(3);
  });

  it('refuses anything that is not path data, so nothing executable rides in', () => {
    expect(typeof parsePath('M0 0 L1 1 <script>')).toBe('string');
    expect(typeof parsePath('url(#x)')).toBe('string');
    expect(typeof parsePath('L1 1')).toBe('string');
  });

  it('writes back what it read', () => {
    const d = 'M0 0C0.2 0 0.8 1 1 1L0 1Z';
    const outline = parsePath(d);
    if (typeof outline === 'string') {
      throw new Error(outline);
    }
    expect(pathData(outline)).toBe(d);
  });
});

describe('parametric shapes fill the unit box', () => {
  it('a square rectangle has four corners and no handles', () => {
    const [c] = rectOutline(0);
    expect(c.vertices.map((v) => v.p)).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ]);
    close(contourLength(c), 4);
  });

  it('roundness cuts the corners into arcs, half roundness is a circle-ish pill', () => {
    const [c] = rectOutline(0.5);
    close(contourLength(c), Math.PI, 2);
  });

  it('an ellipse is a circle of the right length', () => {
    close(contourLength(ellipseOutline()[0]), Math.PI, 2);
  });

  it('a polygon has its sides and points up', () => {
    const [c] = polygonOutline(6, 0);
    expect(c.vertices).toHaveLength(6);
    close(c.vertices[0].p[0], 0.5);
    close(c.vertices[0].p[1], 0);
  });

  it('a star alternates outer and inner radius', () => {
    const [c] = starOutline(5, 0.5, 0);
    expect(c.vertices).toHaveLength(10);
    const r = (i: number) => Math.hypot(c.vertices[i].p[0] - 0.5, c.vertices[i].p[1] - 0.5);
    close(r(0), 0.5);
    close(r(1), 0.25);
  });
});

describe('trim', () => {
  it('keeps the asked share of the length, wrapping with the offset', () => {
    const [square] = rectOutline(0);
    const half = trimContour(square, 0, 0.5, 0);
    close(half.reduce((n, c) => n + contourLength(c), 0), 2);
    const wrapped = trimContour(square, 0, 0.5, 0.75);
    expect(wrapped.length).toBe(2);
    close(wrapped.reduce((n, c) => n + contourLength(c), 0), 2);
    expect(wrapped.every((c) => !c.closed)).toBe(true);
  });

  it('start equal to end draws nothing; 0..1 is the whole shape', () => {
    const [square] = rectOutline(0);
    expect(trimContour(square, 0.3, 0.3, 0)).toEqual([]);
    expect(trimContour(square, 0, 1, 0)).toEqual([square]);
  });
});

describe('flatten', () => {
  it('samples curves densely and keeps straight edges straight', () => {
    expect(flatten(rectOutline(0)[0])).toHaveLength(4);
    expect(flatten(ellipseOutline()[0]).length).toBeGreaterThan(30);
  });
});
