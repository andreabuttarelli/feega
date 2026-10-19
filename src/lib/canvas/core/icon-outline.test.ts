import { describe, expect, it } from 'vitest';
import { iconContours, pathPolylines } from './icon-outline';

const box = (contours: number[][]) => {
  const xs = contours.flatMap((c) => c.filter((_, i) => i % 2 === 0));
  const ys = contours.flatMap((c) => c.filter((_, i) => i % 2 === 1));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v * 100) / 100 + 0);
};

describe('pathPolylines', () => {
  it('follows absolute and relative lines, closing on z', () => {
    const [p] = pathPolylines('M2 2h4v4H2z');

    expect(p.closed).toBe(true);
    expect(p.points).toEqual([2, 2, 6, 2, 6, 6, 2, 6]);
  });

  it('starts a new polyline at each move', () => {
    expect(pathPolylines('M0 0L1 1M5 5l1 0')).toHaveLength(2);
  });

  it('flattens a half-circle arc through its far point', () => {
    const [p] = pathPolylines('M0 0a5 5 0 0 1 10 0');

    expect(box([p.points])).toEqual([0, -5, 10, 0]);
  });

  it('reads arc flags packed against the next number', () => {
    expect(box([pathPolylines('M0 0a5 5 0 0110 0')[0].points])).toEqual([0, -5, 10, 0]);
  });

  it('flattens cubic and quadratic curves to their end points', () => {
    const [c] = pathPolylines('M0 0c0 10 10 10 10 0q5 -5 10 0');

    expect(c.points.slice(-2)).toEqual([20, 0]);
  });
});

describe('iconContours', () => {
  it('strokes a 24-unit icon into a 12px box with lucide round caps', () => {
    const contours = iconContours([['line', { x1: 12, y1: 2, x2: 12, y2: 22 }]], 12, 2);

    expect(box(contours)).toEqual([5.5, 0.5, 6.5, 11.5]);
  });

  it('draws circles and rounded rects', () => {
    expect(box(iconContours([['circle', { cx: 12, cy: 12, r: 10 }]], 24, 2))).toEqual([1, 1, 23, 23]);
    expect(box(iconContours([['rect', { x: 2, y: 4, width: 20, height: 16, rx: 2 }]], 24, 2))).toEqual([1, 3, 23, 21]);
  });
});
