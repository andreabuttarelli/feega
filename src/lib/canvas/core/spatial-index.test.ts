import { describe, expect, it, vi } from 'vitest';
import { SpatialIndex } from './spatial-index';
import { visibleIds } from '$lib/canvas/gpu/camera';

const items = [
  { id: 'a', x: 0, y: 0, w: 100, h: 100 },
  { id: 'b', x: 50, y: 50, w: 100, h: 100 },
  { id: 'c', x: 5000, y: 5000, w: 10, h: 10 },
  { id: 'd', x: -900, y: -900, w: 2000, h: 2000 }
];

describe('spatial index', () => {
  it('the topmost item under a point wins, as the painter draws it', () => {
    const index = new SpatialIndex(items.slice(0, 3));
    expect(index.topAt({ x: 75, y: 75 })).toBe('b');
    expect(index.topAt({ x: 10, y: 10 })).toBe('a');
    expect(index.topAt({ x: 4000, y: 4000 })).toBeNull();
  });

  it('every item under a point comes back, topmost first', () => {
    const index = new SpatialIndex(items.slice(0, 3));
    expect(index.allAt({ x: 75, y: 75 })).toEqual(['b', 'a']);
    expect(index.allAt({ x: 4000, y: 4000 })).toEqual([]);
  });

  it('a big item spanning many cells is found and returned once', () => {
    const index = new SpatialIndex(items);
    expect(index.within({ x: -100, y: -100, w: 50, h: 50 })).toEqual(['d']);
    expect(index.within({ x: 0, y: 0, w: 200, h: 200 })).toEqual(['a', 'b', 'd']);
  });

  it('a query returns ids in paint order', () => {
    const index = new SpatialIndex(items);
    expect(index.within({ x: -10000, y: -10000, w: 20000, h: 20000 })).toEqual(['a', 'b', 'c', 'd']);
  });

  it('agrees with a linear scan on a random scene', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const scene = Array.from({ length: 2000 }, (_, i) => ({ id: `n${i}`, x: rnd() * 40000 - 20000, y: rnd() * 40000 - 20000, w: 50 + rnd() * 3000, h: 50 + rnd() * 3000 }));
    const index = new SpatialIndex(scene);
    for (let k = 0; k < 200; k++) {
      const p = { x: rnd() * 40000 - 20000, y: rnd() * 40000 - 20000 };
      const linear = [...scene].reverse().find((r) => p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h)?.id ?? null;
      expect(index.topAt(p)).toBe(linear);
    }
  });

  it('what the camera sees matches the linear culling', () => {
    const index = new SpatialIndex(items);
    const view = { x: -40, y: -40, zoom: 0.5 };
    const screen = { width: 800, height: 600 };
    expect(index.visible(view, screen)).toEqual(visibleIds(items, view, screen));
  });

  it('a pan inside the same cells matches the linear culling at every step', () => {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const scene = Array.from({ length: 500 }, (_, i) => ({ id: `n${i}`, x: rnd() * 20000 - 10000, y: rnd() * 20000 - 10000, w: 20 + rnd() * 600, h: 20 + rnd() * 600 }));
    const index = new SpatialIndex(scene);
    const screen = { width: 1440, height: 900 };
    for (let step = 0; step < 300; step++) {
      const view = { x: -step * 7, y: step * 3, zoom: 0.8 };
      expect(index.visible(view, screen)).toEqual(visibleIds(scene, view, screen));
    }
  });

  it('a pan that stays inside the same cells does not walk the grid again', () => {
    const scene = Array.from({ length: 400 }, (_, i) => ({ id: `n${i}`, x: (i % 20) * 300, y: Math.floor(i / 20) * 300, w: 100, h: 100 }));
    const index = new SpatialIndex(scene);
    const screen = { width: 1440, height: 900 };
    index.visible({ x: -100, y: -100, zoom: 1 }, screen);
    const reads = vi.spyOn(Map.prototype, 'get');
    index.visible({ x: -101, y: -101, zoom: 1 }, screen);
    const walked = reads.mock.calls.length;
    reads.mockRestore();
    expect(walked).toBe(0);
  });
});
