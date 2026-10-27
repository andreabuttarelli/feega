import { describe, expect, it } from 'vitest';
import { deformOf, dropRadius, dropsOf, field, inverseOf, jellyOf, jellyStrains, smin, strainAlong, NO_STRAIN } from './geometry';

const volume = (radii: number[]) => radii.reduce((v, r) => v + r ** 3, 0);

describe('blob geometry', () => {
  it('melts two surfaces into one below both, and leaves far ones alone', () => {
    expect(smin(10, 10, 8)).toBeLessThan(10);
    expect(smin(-5, 40, 8)).toBe(-5);
    expect(smin(3, 7, 8)).toBeLessThanOrEqual(3);
  });

  it('keeps the volume when one drop splits in two', () => {
    const r = dropRadius(100, 2, 300);

    expect(volume([r, r])).toBeCloseTo(volume([100]), 0);
    expect(dropRadius(100, 2, 0)).toBe(100);
  });

  it('places drops symmetric about the centre along the split angle', () => {
    const [a, b] = dropsOf({ x: 500, y: 300 }, 80, 2, 200, 90);

    expect(a.x).toBeCloseTo(500);
    expect(b.x).toBeCloseTo(500);
    expect(b.y - a.y).toBeCloseTo(200);
    expect((a.y + b.y) / 2).toBeCloseTo(300);
  });

  it('is one sphere when the drops have not split', () => {
    const drops = dropsOf({ x: 0, y: 0 }, 50, 3, 0, 0);

    expect(field({ x: 0, y: 0, z: 0 }, drops, 20, 1)).toBeLessThan(-50);
    expect(field({ x: 0, y: 70, z: 0 }, drops, 20, 1)).toBeGreaterThan(0);
  });

  it('flattens the drop into a lens by its height ratio', () => {
    const drops = dropsOf({ x: 0, y: 0 }, 100, 1, 0, 0);

    expect(field({ x: 0, y: 0, z: 55 }, drops, 20, 0.6)).toBeCloseTo(field({ x: 0, y: 0, z: 0 }, drops, 20, 0.6) + 55 / 0.6);
  });

  it('stretches along a direction and narrows across it, keeping the area', () => {
    const d = deformOf(strainAlong({ x: 1, y: 0 }, 0.4));

    expect(d.xx).toBeGreaterThan(1);
    expect(d.yy).toBeLessThan(1);
    expect(d.xx * d.yy - d.xy * d.xy).toBeCloseTo(1);
    const back = inverseOf(d);
    expect(back.xx * d.xx + back.xy * d.xy).toBeCloseTo(1);
  });

  it('never folds the drop, however hard it is pushed', () => {
    const d = deformOf(strainAlong({ x: 0, y: 1 }, 50));

    expect(d.xx).toBeGreaterThan(0);
    expect(d.yy).toBeGreaterThan(0);
  });

  it('wobbles after a push and settles, slower when more viscous', () => {
    const push = Array.from({ length: 90 }, (_, i) => (i < 6 ? strainAlong({ x: 1, y: 0 }, 0.3) : NO_STRAIN));
    const runny = jellyStrains(push, push.map(() => jellyOf(0)), 30).map((e) => e.p);
    const thick = jellyStrains(push, push.map(() => jellyOf(1)), 30).map((e) => e.p);

    expect(Math.min(...runny)).toBeLessThan(0);
    expect(Math.abs(runny[89])).toBeLessThan(0.005);
    expect(Math.min(...thick)).toBeGreaterThan(Math.min(...runny));
  });
});
