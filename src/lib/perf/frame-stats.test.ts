import { describe, expect, it } from 'vitest';
import { frameStats, HISTOGRAM_EDGES_MS } from './frame-stats';
import { perfHudWanted } from './perf-hud-switch';

const steady = (ms: number, count: number) => Array.from({ length: count }, () => ms);

describe('frameStats', () => {
  it('reads a ProMotion display at 120 Hz from 8.3 ms gaps', () => {
    const stats = frameStats(steady(1000 / 120, 240));

    expect(stats.rate).toBe(120);
    expect(stats.worst5Fps).toBe(120);
  });

  it('reads a 60 Hz cap, as Safari gives with its default setting', () => {
    expect(frameStats(steady(1000 / 60, 120)).rate).toBe(60);
  });

  it('puts a dropped frame in the worst 5% and the max, not in the median', () => {
    const stats = frameStats([...steady(1000 / 120, 95), ...steady(50, 5)]);

    expect(stats.p50).toBeCloseTo(8.3, 1);
    expect(stats.p95).toBe(50);
    expect(stats.max).toBe(50);
    expect(stats.worst5Fps).toBe(20);
  });

  it('counts every gap into one histogram bucket, the last one open', () => {
    const stats = frameStats([5, 9, 12, 20, 40, 400]);

    expect(stats.histogram).toHaveLength(HISTOGRAM_EDGES_MS.length + 1);
    expect(stats.histogram.reduce((a, b) => a + b, 0)).toBe(6);
    expect(stats.histogram.at(-1)).toBe(1);
  });

  it('reports nothing rather than a fake rate before the first frame', () => {
    expect(frameStats([]).rate).toBe(0);
  });
});

describe('perfHudWanted', () => {
  it('turns on with ?perf=1', () => {
    expect(perfHudWanted('?perf=1', null)).toBe(true);
  });

  it('turns on from the stored flag, so a phone keeps it across navigations', () => {
    expect(perfHudWanted('', '1')).toBe(true);
  });

  it('turns off with ?perf=0 even when stored', () => {
    expect(perfHudWanted('?perf=0', '1')).toBe(false);
  });

  it('stays off by default', () => {
    expect(perfHudWanted('?x=1', null)).toBe(false);
  });
});
