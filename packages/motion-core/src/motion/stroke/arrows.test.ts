import { describe, expect, it } from 'vitest';
import { ArrowCap, arrowHeads, ARROW_CAPS } from './arrows';
import type { Outline } from '../shape/geometry';

const line = (closed = false): Outline => [
  {
    closed,
    vertices: [
      { p: [0, 0], in: [0, 0], out: [0, 0] },
      { p: [100, 0], in: [100, 0], out: [100, 0] }
    ]
  }
];

const xs = (polys: number[][]) => polys.flatMap((p) => p.filter((_, i) => i % 2 === 0));

describe('arrow caps', () => {
  it('has every figma cap that is not a plain line end', () => {
    expect(ARROW_CAPS).toEqual(['none', 'line-arrow', 'triangle-arrow', 'reversed-triangle', 'circle', 'diamond']);
  });

  it('no caps draw nothing', () => {
    expect(arrowHeads(line(), { start: ArrowCap.None, end: ArrowCap.None }, 10)).toEqual([]);
  });

  it('a triangle at the end points past the last vertex', () => {
    const heads = arrowHeads(line(), { start: ArrowCap.None, end: ArrowCap.TriangleArrow }, 10);
    expect(heads).toHaveLength(1);
    expect(Math.max(...xs(heads))).toBeGreaterThan(100);
    expect(Math.min(...xs(heads))).toBeGreaterThanOrEqual(100);
  });

  it('a start cap points back past the first vertex', () => {
    const heads = arrowHeads(line(), { start: ArrowCap.TriangleArrow, end: ArrowCap.None }, 10);
    expect(Math.min(...xs(heads))).toBeLessThan(0);
  });

  it('a reversed triangle points back into the line', () => {
    const heads = arrowHeads(line(), { start: ArrowCap.None, end: ArrowCap.ReversedTriangle }, 10);
    expect(Math.min(...xs(heads))).toBeLessThan(100);
  });

  it('every cap kind draws something', () => {
    for (const cap of ARROW_CAPS.filter((c) => c !== ArrowCap.None)) {
      expect({ cap, drawn: arrowHeads(line(), { start: cap, end: cap }, 10).length > 0 }).toEqual({ cap, drawn: true });
    }
  });

  it('a closed contour has no ends to cap', () => {
    expect(arrowHeads(line(true), { start: ArrowCap.Circle, end: ArrowCap.Circle }, 10)).toEqual([]);
  });
});
