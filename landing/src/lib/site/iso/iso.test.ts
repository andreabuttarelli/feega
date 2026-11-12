import { describe, expect, it } from 'vitest';
import { project, slab } from './iso';

describe('isometric projection', () => {
  it('runs both ground axes at 30 degrees and height straight up', () => {
    const [ax, ay] = project(100, 0);
    const [bx, by] = project(0, 100);
    expect(ay / ax).toBeCloseTo(Math.tan(Math.PI / 6), 2);
    expect(by / -bx).toBeCloseTo(Math.tan(Math.PI / 6), 2);
    expect(project(0, 0, 40)).toEqual([0, -40]);
  });

  it('a slab shows its top above its two front faces', () => {
    const faces = slab({ x: 0, y: 0, w: 100, d: 60, t: 10 });
    const ys = (pts: string) => pts.split(' ').map((p) => Number(p.split(',')[1]));
    expect(Math.min(...ys(faces.top))).toBeLessThan(Math.min(...ys(faces.left)));
    expect(Math.max(...ys(faces.left))).toBe(Math.max(...ys(faces.right)));
  });
});
