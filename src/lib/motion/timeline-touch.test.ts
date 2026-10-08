import { describe, expect, it } from 'vitest';
import { Axis, lockAxis, pinchView } from './timeline-touch';
import { Pointer, SNAP_RADIUS_PX, pxPerFrame, snapFrames } from './timeline-view';

describe('timeline on touch', () => {
  it('zooms around the pinch midpoint: the frame under the fingers stays under them', () => {
    const start = { zoom: 1, scrollLeft: 100, mid: 200, distance: 100 };
    const view = pinchView(start, { mid: 200, distance: 200 });

    expect(view.zoom).toBe(2);
    expect(view.scrollLeft).toBe(400);
  });

  it('two fingers moving together pan the timeline', () => {
    const start = { zoom: 1, scrollLeft: 100, mid: 200, distance: 100 };

    expect(pinchView(start, { mid: 150, distance: 100 })).toEqual({ zoom: 1, scrollLeft: 150 });
  });

  it('never scrolls before the start', () => {
    const start = { zoom: 1, scrollLeft: 0, mid: 10, distance: 100 };

    expect(pinchView(start, { mid: 300, distance: 100 }).scrollLeft).toBe(0);
  });

  it('locks a drag to one axis after 8px, not before', () => {
    expect(lockAxis(5, 2)).toBeNull();
    expect(lockAxis(12, 3)).toBe(Axis.Horizontal);
    expect(lockAxis(-3, -20)).toBe(Axis.Vertical);
  });

  it('snaps within a radius in pixels, wider for a finger', () => {
    expect(SNAP_RADIUS_PX[Pointer.Fine]).toBe(12);
    expect(SNAP_RADIUS_PX[Pointer.Coarse]).toBe(20);
    const ppf = pxPerFrame(1, 30);

    expect(snapFrames(Pointer.Coarse, ppf)).toBe(10);
    expect(snapFrames(Pointer.Fine, ppf)).toBe(6);
    expect(snapFrames(Pointer.Fine, 100)).toBe(1);
  });
});
