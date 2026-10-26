import { describe, expect, it } from 'vitest';
import { frameScreenMap, frameScreenRect } from './frame-screen';

const FRAME = { x: 100, y: 50, w: 400, h: 300, bar: 20 };

describe('frameScreenRect', () => {
  it('puts the picture below the title bar at zoom 1 without pan', () => {
    expect(frameScreenRect({ x: 0, y: 0, zoom: 1 }, FRAME)).toEqual({ left: 100, top: 70, width: 400, height: 280 });
  });

  it('scales position, size and bar with zoom, then pans', () => {
    expect(frameScreenRect({ x: 10, y: -20, zoom: 2 }, FRAME)).toEqual({ left: 210, top: 120, width: 800, height: 560 });
  });
});

describe('frameScreenMap', () => {
  const doc = { width: 1000, height: 500 };

  it('maps a doc point to the screen under zoom, pan and bar offset', () => {
    const map = frameScreenMap({ x: 10, y: -20, zoom: 2 }, FRAME, doc);
    expect(map.toScreen([0, 0])).toEqual([210, 120]);
    expect(map.toScreen([1000, 500])).toEqual([1010, 680]);
  });

  it('round-trips screen to doc', () => {
    const map = frameScreenMap({ x: 33, y: 7, zoom: 0.5 }, FRAME, doc);
    const [x, y] = map.toDoc(map.toScreen([250, 125]));
    expect(x).toBeCloseTo(250);
    expect(y).toBeCloseTo(125);
  });
});
