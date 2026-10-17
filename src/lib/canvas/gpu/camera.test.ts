import { describe, expect, it } from 'vitest';
import { hitTop, panBy, toWorld, visibleIds, zoomAt } from './camera';

const rects = [
  { id: 'a', x: 0, y: 0, w: 100, h: 100 },
  { id: 'b', x: 50, y: 50, w: 100, h: 100 },
  { id: 'c', x: 5000, y: 5000, w: 10, h: 10 }
];

describe('camera', () => {
  it('zooming keeps the world point under the cursor fixed', () => {
    const view = { x: 30, y: -20, zoom: 0.5 };
    const cursor = { x: 400, y: 300 };
    const before = toWorld(view, cursor);
    const after = toWorld(zoomAt(view, cursor, 2), cursor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('zoom stays inside its bounds', () => {
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0 }, 1000).zoom).toBe(4);
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0 }, 0.0001).zoom).toBe(0.05);
  });

  it('pans in screen pixels', () => {
    expect(panBy({ x: 1, y: 2, zoom: 3 }, { x: 10, y: -5 })).toEqual({ x: 11, y: -3, zoom: 3 });
  });

  it('hit-testing picks the topmost node under the point', () => {
    expect(hitTop(rects, { x: 75, y: 75 })?.id).toBe('b');
    expect(hitTop(rects, { x: 10, y: 10 })?.id).toBe('a');
    expect(hitTop(rects, { x: 300, y: 300 })).toBeNull();
  });

  it('culls nodes outside the screen', () => {
    expect(visibleIds(rects, { x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 })).toEqual(new Set(['a', 'b']));
  });
});
