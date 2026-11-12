import { describe, expect, it } from 'vitest';
import { report, sizeBucket, SizeBucket } from './canvas-perf-report.mjs';

const session = (over: Record<string, unknown> = {}) => ({ user_id: 'u1', props: { device: 'desktop', frames: 5, backend: 'webgpu', fallbacks: 0, load: { firstContent: 400, sharp: 1000 }, gestures: { pan: { frames: 100, over: 0.1 } }, edit: { n: 2, p50: 40, p95: 80 }, ...over } });

describe('canvas perf report', () => {
  it('buckets canvases by frame count', () => {
    expect(sizeBucket(3)).toBe(SizeBucket.Small);
    expect(sizeBucket(30)).toBe(SizeBucket.Medium);
    expect(sizeBucket(300)).toBe(SizeBucket.Huge);
  });

  it('groups by device and size, weighting over-budget frames by frame count', () => {
    const rows = report([session(), session({ gestures: { pan: { frames: 300, over: 0.5 } }, backend: 'webgl', fallbacks: 1 }), session({ device: 'phone' })], new Set());

    const desktop = rows.find((r) => r.device === 'desktop');
    expect(desktop).toMatchObject({ size: SizeBucket.Small, sessions: 2, webglFallback: 0.5 });
    expect(desktop?.over.pan).toBeCloseTo(0.4);
    expect(rows.find((r) => r.device === 'phone')?.sessions).toBe(1);
  });

  it('keeps only the latest summary of a session', () => {
    const rows = report([session({ sessionId: 's', sessionMs: 300_000 }), session({ sessionId: 's', sessionMs: 600_000 })], new Set());

    expect(rows[0].sessions).toBe(1);
  });

  it('leaves internal users out', () => {
    expect(report([session(), session({}), { ...session(), user_id: 'team' }], new Set(['team']))[0].sessions).toBe(2);
  });
});
