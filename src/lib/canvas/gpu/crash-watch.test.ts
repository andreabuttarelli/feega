import { describe, expect, it } from 'vitest';
import { blankSample, wasInGesture } from './crash-record';
import { Motion, track, type Tick } from './crash-watch';

const tick = (over: Partial<Tick>): Tick => ({ x: 0, y: 0, zoom: 1, now: 0, motion: Motion.Moving, rastered: false, ...over });

describe('the live sample', () => {
  it('measures zoom speed in doublings per second and pan speed in px per second', () => {
    const s = blankSample();
    track(s, tick({ now: 0 }));
    track(s, tick({ now: 500, zoom: 2, x: 100 }));

    expect(s.zoomPerSecond).toBeCloseTo(2);
    expect(s.panPerSecond).toBeCloseTo(200);
  });

  it('counts frames since the gesture started and restarts when it stops', () => {
    const s = blankSample();
    track(s, tick({ now: 0 }));
    track(s, tick({ now: 16 }));
    expect(s.gestureFrames).toBe(2);

    track(s, tick({ now: 32, motion: Motion.Still }));
    expect(s.gestureFrames).toBe(0);
  });

  it('remembers the zoom of the last raster', () => {
    const s = blankSample();
    track(s, tick({ now: 0, zoom: 1.5, rastered: true }));
    track(s, tick({ now: 16, zoom: 3 }));

    expect(s.rasterZoom).toBe(1.5);
    expect(s.zoom).toBe(3);
  });
});

describe("which crash records are worth sending", () => {
  it("only those written during a gesture", () => {
    expect(wasInGesture({ ...blankSample(), gestureFrames: 3 })).toBe(true);
    expect(wasInGesture({ ...blankSample(), gestureFrames: 0 })).toBe(false);
  });
});
