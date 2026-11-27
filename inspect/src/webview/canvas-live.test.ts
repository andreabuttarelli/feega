import { describe, expect, it } from 'vitest';
import { CANVAS_COLUMNS, layoutCanvas } from './canvas-layout';
import { VISIBLE_MARGIN, liveSet, visibleKeys } from './canvas-live';

describe('liveSet minimum width', () => {
  const frames = [{ key: 'a', dynamic: false as const, x: 0, y: 0, width: 480, height: 320 }];
  const small = { scale: 0.3, x: 0, y: 0 };
  const viewport = { w: 1000, h: 800 };

  it('keeps a frame that is too small on screen asleep by default', () => {
    expect(liveSet(frames, small, viewport, [])).toEqual([]);
  });

  it('wakes it when the canvas has no minimum width', () => {
    expect(liveSet(frames, small, viewport, [], 0)).toEqual(['a']);
  });
});

const pages = Array.from({ length: 10 }, (_, i) => ({ route: `/p${i}`, dynamic: i === 9 }));
const { frames } = layoutCanvas(pages, CANVAS_COLUMNS);
const viewport = { w: 1000, h: 800 };
const home = { scale: 1, x: 0, y: 0 };

describe('visibleKeys', () => {
  it('lists the frames that touch the viewport', () => {
    const keys = visibleKeys(frames, home, viewport, 0);

    expect(keys).toContain('/p0::desktop');
    expect(keys).not.toContain('/p0::tablet');
    expect(keys).not.toContain('/p1::desktop');
  });

  it('adds a margin around the viewport, in screen pixels', () => {
    const tablet = frames[1];
    const view = { scale: 1, x: viewport.w + VISIBLE_MARGIN - 1 - tablet.x, y: 0 };

    expect(visibleKeys(frames, view, viewport, VISIBLE_MARGIN)).toContain('/p0::tablet');
    expect(visibleKeys(frames, view, viewport, 0)).not.toContain('/p0::tablet');
  });

  it('follows pan and zoom', () => {
    const far = { scale: 0.1, x: 0, y: -frames[3].y * 0.1 };

    expect(visibleKeys(frames, far, viewport, 0)).toContain('/p1::desktop');
  });
});
