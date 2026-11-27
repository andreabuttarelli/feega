import { describe, expect, it } from 'vitest';
import { CANVAS_COLUMNS, layoutCanvas } from './canvas-layout';
import { LIVE_CAP, VISIBLE_MARGIN, leaving, liveKeys, visibleKeys } from './canvas-live';

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

describe('liveKeys', () => {
  const zoomedOut = { scale: 0.05, x: 0, y: 0 };

  it('never runs more than the cap', () => {
    expect(visibleKeys(frames, zoomedOut, viewport, 0).length).toBeGreaterThan(LIVE_CAP);
    expect(liveKeys(frames, zoomedOut, viewport, 0, LIVE_CAP)).toHaveLength(LIVE_CAP);
  });

  it('prefers the frames nearest the centre of the viewport', () => {
    const live = liveKeys(frames, zoomedOut, viewport, 0, 1);
    const distance = (key: string) => {
      const f = frames.find((x) => x.key === key)!;
      return Math.hypot(f.x * 0.05 + (f.width * 0.05) / 2 - viewport.w / 2, f.y * 0.05 + (f.height * 0.05) / 2 - viewport.h / 2);
    };
    const best = Math.min(...visibleKeys(frames, zoomedOut, viewport, 0).map(distance));

    expect(distance(live[0])).toBe(best);
  });

  it('skips dynamic routes', () => {
    const live = liveKeys(frames, { scale: 0.02, x: 0, y: 0 }, { w: 4000, h: 40000 }, 0, 99);

    expect(live.some((key) => key.startsWith('/p9'))).toBe(false);
    expect(live).toHaveLength(27);
  });
});

describe('leaving', () => {
  it('names the frames that were live and no longer are', () => {
    expect(leaving(['a', 'b', 'c'], ['b', 'd'])).toEqual(['a', 'c']);
    expect(leaving([], ['a'])).toEqual([]);
  });
});
