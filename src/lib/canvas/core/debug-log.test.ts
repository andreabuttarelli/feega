import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEBUG_STORAGE_KEY, debugOn, debugStart, formatMark, gestureLog, type Sink } from './debug-log';

const sink = (): Sink & { lines: string[] } => {
  const lines: string[] = [];
  return { lines, line: (text) => lines.push(text), open: (text) => lines.push(`> ${text}`), close: () => lines.push('<') };
};

describe('debug switch', () => {
  it('is off by default', () => {
    expect(debugOn('', null)).toBe(false);
  });

  it('turns on with ?debug', () => {
    expect(debugOn('?debug', null)).toBe(true);
  });

  it('turns on with localStorage 1', () => {
    expect(debugOn('', '1')).toBe(true);
    expect(debugOn('', '0')).toBe(false);
  });

  it('reads storage safely when it throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(debugStart('', sink())).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('when off', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('subscribes to nothing and prints nothing', () => {
    const out = sink();
    const observer = vi.fn();
    vi.stubGlobal('PerformanceObserver', observer);

    expect(debugStart('', out)).toBe(false);
    gestureLog('pan', out);

    expect(observer).not.toHaveBeenCalled();
    expect(out.lines).toEqual([]);
  });
});

describe('marks', () => {
  it('formats a startup mark with its tag and time', () => {
    expect(formatMark({ name: 'startup|gpu-ready', startTime: 812.4 })).toBe('[feega] [startup]    812ms gpu-ready');
  });

  it('formats a frame step with the frame id', () => {
    expect(formatMark({ name: 'frame|built|abc:0.5', startTime: 1500 })).toBe('[feega] [build]   1500ms abc:0.5 built');
  });

  it('tags upload, raster, tiles and posters steps', () => {
    expect(formatMark({ name: 'frame|put|a', startTime: 1 })).toContain('[upload]');
    expect(formatMark({ name: 'frame|drawn|a', startTime: 1 })).toContain('[raster]');
    expect(formatMark({ name: 'frame|thumb|a', startTime: 1 })).toContain('[posters]');
    expect(formatMark({ name: 'frame|images|a', startTime: 1 })).toContain('[images]');
  });

  it('ignores marks that are not ours', () => {
    expect(formatMark({ name: 'other', startTime: 1 })).toBeNull();
  });
});

describe('gestures', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('logs start and a long frame with the gesture name', () => {
    vi.stubGlobal('localStorage', { getItem: () => '1' });
    const out = sink();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('setTimeout', () => 0);

    gestureLog('zoom', out, '');
    frames[0](100);
    frames[1](150);

    expect(out.lines.some((l) => l.includes('[camera]') && l.includes('zoom') && l.includes('start'))).toBe(true);
    expect(out.lines.some((l) => l.includes('long frame') && l.includes('zoom') && l.includes('50ms'))).toBe(true);
  });
});
