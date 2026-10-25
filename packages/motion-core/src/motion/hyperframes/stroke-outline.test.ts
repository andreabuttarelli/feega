import { describe, expect, it } from 'vitest';
import { strokePolygons } from './stroke-outline';

const area = (poly: number[][]) => Math.abs(poly.reduce((sum, [x, y], i) => {
  const [nx, ny] = poly[(i + 1) % poly.length];
  return sum + x * ny - nx * y;
}, 0)) / 2;

describe('strokePolygons', () => {
  it('a straight stroke becomes a band as wide as the stroke', () => {
    const [band] = strokePolygons([[0, 0], [10, 0]], 2, 'butt');

    expect(area(band)).toBeCloseTo(20);
    expect(Math.min(...band.map((p) => p[1]))).toBeCloseTo(-1);
  });

  it('a square cap extends each end by half the width', () => {
    const [band] = strokePolygons([[0, 0], [10, 0]], 2, 'square');

    expect(area(band)).toBeCloseTo(24);
  });

  it('a bend gets a joint so the corner is filled', () => {
    const polys = strokePolygons([[0, 0], [10, 0], [10, 10]], 2, 'butt');

    expect(polys.length).toBe(3);
  });

  it('runs from its own source, as the page embeds it', () => {
    const inlined = new Function(`return (${String(strokePolygons)});`)() as typeof strokePolygons;

    expect(inlined([[0, 0], [10, 0]], 2, 'butt')).toEqual(strokePolygons([[0, 0], [10, 0]], 2, 'butt'));
  });
});
