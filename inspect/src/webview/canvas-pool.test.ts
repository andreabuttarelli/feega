import { describe, expect, it, vi } from 'vitest';
import { CANVAS_COLUMNS, layoutCanvas } from './canvas-layout';
import { LIVE_CAP, MIN_LIVE_WIDTH, STICKY_MARGIN, VISIBLE_MARGIN, liveSet } from './canvas-live';
import { MAX_LOADING, POOL_CAP, SETTLE_MS, planPool, settler } from './canvas-pool';

const pages = Array.from({ length: 12 }, (_, i) => ({ route: `/p${i}`, dynamic: i === 11 }));
const { frames } = layoutCanvas(pages, CANVAS_COLUMNS);
const viewport = { w: 1000, h: 800 };
const none = new Set<string>();

describe('liveSet', () => {
  it('shows nothing live while frames are too small to read', () => {
    const far = { scale: 0.1, x: 0, y: 0 };

    expect(frames[0].width * far.scale).toBeLessThan(MIN_LIVE_WIDTH);
    expect(liveSet(frames, far, viewport, [])).toEqual([]);
  });

  it('goes live once frames are wide enough on screen', () => {
    const near = { scale: 0.5, x: 0, y: 0 };
    const live = liveSet(frames, near, viewport, []);

    expect(live.length).toBeGreaterThan(0);
    expect(live.length).toBeLessThanOrEqual(LIVE_CAP);
  });

  it('keeps a frame that drifted just past the margin when it was already live', () => {
    const f = frames[0];
    const view = { scale: 0.5, x: -(f.x + f.width) * 0.5 - VISIBLE_MARGIN - STICKY_MARGIN / 2, y: 0 };

    expect(liveSet(frames, view, viewport, [])).not.toContain(f.key);
    expect(liveSet(frames, view, viewport, [f.key])).toContain(f.key);
  });

  it('drops a frame far beyond the sticky margin', () => {
    const f = frames[0];
    const view = { scale: 0.5, x: -(f.x + f.width) * 0.5 - VISIBLE_MARGIN - STICKY_MARGIN * 2, y: 0 };

    expect(liveSet(frames, view, viewport, [f.key])).not.toContain(f.key);
  });

  it('never includes dynamic routes', () => {
    const view = { scale: 0.5, x: 0, y: -frames.find((f) => f.dynamic)!.y * 0.5 };

    expect(liveSet(frames, view, viewport, []).some((k) => k.startsWith('/p11'))).toBe(false);
  });
});

describe('planPool', () => {
  const plan = (pool: string[], wanted: string[], settled = none) => planPool({ pool, wanted, settled, cap: POOL_CAP, maxLoading: MAX_LOADING });

  it('starts at most two loads at once, in the given order', () => {
    expect(plan([], ['a', 'b', 'c', 'd']).pool).toEqual(['a', 'b']);
  });

  it('starts more as loads finish', () => {
    expect(plan(['a', 'b'], ['a', 'b', 'c', 'd'], new Set(['a'])).pool).toEqual(['a', 'b', 'c']);
  });

  it('keeps loaded frames mounted when they leave the wanted set', () => {
    const result = plan(['a', 'b'], ['c'], new Set(['a', 'b']));

    expect(result.pool).toEqual(['a', 'b', 'c']);
    expect(result.evicted).toEqual([]);
  });

  it('evicts the least recently wanted frame past the cap, never a wanted one', () => {
    const pool = Array.from({ length: POOL_CAP }, (_, i) => `k${i}`);
    const result = plan(pool, ['k0', 'new'], new Set(pool));

    expect(result.evicted).toEqual(['k1']);
    expect(result.pool).toHaveLength(POOL_CAP);
    expect(result.pool).toContain('k0');
    expect(result.pool).toContain('new');
  });

  it('does not reload a frame that is already in the pool', () => {
    const result = plan(['a'], ['a'], new Set(['a']));

    expect(result.pool).toEqual(['a']);
    expect(result.evicted).toEqual([]);
  });
});

describe('settler', () => {
  it('fires once, after the last call has been quiet for the settle time', () => {
    vi.useFakeTimers();
    const fire = vi.fn();
    const settle = settler(fire, SETTLE_MS);

    settle();
    vi.advanceTimersByTime(SETTLE_MS - 1);
    settle();
    vi.advanceTimersByTime(SETTLE_MS - 1);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
