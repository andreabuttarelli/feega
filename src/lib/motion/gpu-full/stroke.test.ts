import { describe, expect, it } from 'vitest';
import { dashes, strokePolygons, Cap, Join } from './stroke';

const area = (poly: number[]) => {
  let a = 0;
  for (let i = 0; i < poly.length; i += 2) {
    const j = (i + 2) % poly.length;
    a += poly[i] * poly[j + 1] - poly[j] * poly[i + 1];
  }
  return Math.abs(a) / 2;
};
const total = (polys: number[][]) => polys.reduce((s, p) => s + area(p), 0);
const extent = (polys: number[][]) => {
  const xs = polys.flatMap((p) => p.filter((_, i) => i % 2 === 0));
  const ys = polys.flatMap((p) => p.filter((_, i) => i % 2 === 1));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

describe('miter limit', () => {
  const sharp = [0, 0, 100, 10, 0, 20];

  it('a higher miter limit keeps a sharp corner pointed', () => {
    const bevelled = extent(strokePolygons(sharp, false, 4, Cap.Butt, Join.Miter));
    const pointed = extent(strokePolygons(sharp, false, 4, Cap.Butt, Join.Miter, 50));
    expect(pointed[2]).toBeGreaterThan(bevelled[2] + 5);
  });
});

describe('strokePolygons', () => {
  it('covers a butt line as one width-wide band', () => {
    const polys = strokePolygons([0, 0, 100, 0], false, 10, Cap.Butt, Join.Miter);

    expect(total(polys)).toBeCloseTo(1000);
    expect(extent(polys)).toEqual([0, -5, 100, 5]);
  });

  it('extends a square cap by half the width at each end', () => {
    expect(extent(strokePolygons([0, 0, 100, 0], false, 10, Cap.Square, Join.Miter))).toEqual([-5, -5, 105, 5]);
  });

  it('closes a square with mitred corners', () => {
    const polys = strokePolygons([0, 0, 100, 0, 100, 100, 0, 100], true, 10, Cap.Butt, Join.Miter);

    expect(extent(polys)).toEqual([-5, -5, 105, 105]);
  });

  it('bevels a corner sharper than the miter limit', () => {
    const sharp = [0, 0, 100, 0, 0, 5];

    expect(extent(strokePolygons(sharp, false, 10, Cap.Butt, Join.Miter))[2]).toBeLessThan(120);
  });
});

describe('dashes', () => {
  it('cuts a line into dash-long pieces separated by gaps', () => {
    expect(dashes([0, 0, 100, 0], false, 20, 10)).toEqual([
      [0, 0, 20, 0],
      [30, 0, 50, 0],
      [60, 0, 80, 0],
      [90, 0, 100, 0]
    ]);
  });
});
