import { describe, expect, it } from 'vitest';
import { Op } from './face';
import { clipped, contoursOf, dilated } from './outline';

const extent = (contours: number[][]) => {
  const xs = contours.flatMap((c) => c.filter((_, i) => i % 2 === 0));
  const ys = contours.flatMap((c) => c.filter((_, i) => i % 2 === 1));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

describe('contoursOf', () => {
  it('scales font units to pixels with y pointing down', () => {
    const square = [{ op: Op.Move, at: [0, 0] }, { op: Op.Line, at: [1000, 0] }, { op: Op.Line, at: [1000, 500] }, { op: Op.Close, at: [] }];

    expect(contoursOf(square, 0.1, 0)).toEqual([[0, -0, 100, -0, 100, -50]]);
  });

  it('flattens a curve finely enough that no point strays from it', () => {
    const arc = [{ op: Op.Move, at: [0, 0] }, { op: Op.Quad, at: [500, 1000, 1000, 0] }, { op: Op.Close, at: [] }];
    const [contour] = contoursOf(arc, 1, 0);
    const ys = contour.filter((_, i) => i % 2 === 1);

    expect(contour.length / 2).toBeGreaterThan(20);
    expect(Math.min(...ys)).toBeCloseTo(-500, 0);
  });

  it('leans an oblique outline to the right as it rises', () => {
    const post = [{ op: Op.Move, at: [0, 0] }, { op: Op.Line, at: [0, 1000] }, { op: Op.Line, at: [10, 1000] }, { op: Op.Close, at: [] }];

    expect(contoursOf(post, 0.1, 0.25)[0].slice(0, 4)).toEqual([0, -0, 25, -100]);
  });
});

describe('clipped', () => {
  it('cuts contours to a rectangle', () => {
    const square = [[0, 0, 100, 0, 100, 100, 0, 100]];

    expect(extent(clipped(square, [20, -10, 60, 50]))).toEqual([20, 0, 60, 50]);
  });

  it('drops contours entirely outside', () => {
    expect(clipped([[0, 0, 10, 0, 10, 10]], [50, 50, 60, 60])).toEqual([]);
  });
});

describe('dilated', () => {
  it('pushes every edge of a glyph outward, holes inward', () => {
    const outer = [0, 0, 100, 0, 100, 100, 0, 100];
    const hole = [25, 25, 25, 75, 75, 75, 75, 25];

    expect(extent(dilated([outer, hole], 0.5))).toEqual([-0.5, -0.5, 100.5, 100.5]);
    expect(extent([dilated([outer, hole], 0.5)[1]])).toEqual([25.5, 25.5, 74.5, 74.5]);
  });

  it('pushes outward whichever way the outer contour turns', () => {
    const reversed = [0, 100, 100, 100, 100, 0, 0, 0];

    expect(extent(dilated([reversed], 1))).toEqual([-1, -1, 101, 101]);
  });

  it('never spikes where two curves meet on the same point twice', () => {
    const ring = Array.from({ length: 48 }, (_, i) => [50 + 40 * Math.cos((i / 48) * 2 * Math.PI), 50 + 40 * Math.sin((i / 48) * 2 * Math.PI)]);
    const joined = ring.flatMap(([x, y], i) => (i === 12 ? [x, y, x, y] : [x, y]));
    const out = dilated([joined], 0.3)[0];
    const reach = Math.max(...Array.from({ length: out.length / 2 }, (_, i) => Math.abs(Math.hypot(out[i * 2] - 50, out[i * 2 + 1] - 50) - 40)));
    expect(reach).toBeLessThan(0.45);
  });
});
