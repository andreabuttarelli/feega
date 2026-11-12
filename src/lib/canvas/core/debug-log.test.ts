import { afterEach, describe, expect, it, vi } from 'vitest';
import { debugActive, debugOn, debugStart, debugStop, formatMark, frameSummary, gestureLog, ordered, renderEvents, renderLog, teeSink, tierLog, type RenderSample, type Sink } from './debug-log';

const sink = (): Sink & { lines: string[] } => {
  const lines: string[] = [];
  return { lines, line: (text) => lines.push(text), group: (title, body) => lines.push(`> ${title} | ${body.join(' ; ')}`) };
};

afterEach(() => {
  debugStop();
  vi.unstubAllGlobals();
});

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

  it('stays on for the tab after ?debug, so a reload after a crash keeps recording', () => {
    const kept = new Map<string, string>();
    const tab = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };

    expect(debugOn('?debug=1', null, tab)).toBe(true);
    expect(debugOn('', null, tab)).toBe(true);
    expect(debugOn('?debug=0', null, tab)).toBe(false);
    expect(debugOn('', null, tab)).toBe(false);
  });

  it('reads storage safely when it throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(debugStart('', sink())).toBe(false);
  });
});

describe('a tee of sinks', () => {
  it('hands every line and group to each sink', () => {
    const a = sink();
    const b = sink();
    const both = teeSink(a, b);

    both.line('one');
    both.group('title', ['x']);

    expect(a.lines).toEqual(['one', '> title | x']);
    expect(b.lines).toEqual(['one', '> title | x']);
  });
});

describe('when off', () => {
  it('subscribes to nothing and prints nothing', () => {
    const out = sink();
    const observer = vi.fn();
    vi.stubGlobal('PerformanceObserver', observer);

    expect(debugStart('', out)).toBe(false);
    gestureLog('pan');
    tierLog('256', 0.1);
    renderLog({ at: 1, outcome: 'full', tally: '{"raster":{"n":1,"ms":1}}', cacheBytes: 0, pending: false, moving: false });

    expect(debugActive()).toBe(false);
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

  it('tags upload, raster, posters and images steps', () => {
    expect(formatMark({ name: 'frame|put|a', startTime: 1 })).toContain('[upload]');
    expect(formatMark({ name: 'frame|drawn|a', startTime: 1 })).toContain('[raster]');
    expect(formatMark({ name: 'frame|thumb|a', startTime: 1 })).toContain('[posters]');
    expect(formatMark({ name: 'frame|images|a', startTime: 1 })).toContain('[images]');
  });

  it('ignores marks that are not ours', () => {
    expect(formatMark({ name: 'other', startTime: 1 })).toBeNull();
  });
});

describe('frame summary', () => {
  it('computes the duration between each step of the chain', () => {
    const { title, lines } = frameSummary('a', [
      { step: 'asked', at: 100 },
      { step: 'source', at: 150 },
      { step: 'built', at: 180 },
      { step: 'put', at: 200 },
      { step: 'drawn', at: 260 }
    ]);

    expect(lines).toEqual(['asked -> source 50ms', 'source -> built 30ms', 'built -> put 20ms', 'put -> drawn 60ms']);
    expect(title).toContain('a drawn, 160ms from asked');
  });
});

describe('chronological order', () => {
  it('flushes buffered lines sorted by time', () => {
    const out = sink();
    let flush = () => {};
    const queue = ordered(out, (f) => (flush = f));

    queue.push(300, 'c');
    queue.push(100, 'a');
    queue.push(200, 'b', ['x']);
    flush();

    expect(out.lines).toEqual(['a', '> b | x', 'c']);
  });
});

describe('render events', () => {
  const sample = (over: Partial<RenderSample>): RenderSample => ({ at: 1, outcome: 'reused', tally: '{}', cacheBytes: 100, pending: false, moving: false, ...over });

  it('reports rest render start when a gesture ends', () => {
    const events = renderEvents(sample({ moving: true }), sample({ moving: false }));

    expect(events.join()).toContain('rest render start');
  });

  it('reports rastered passes with their ms', () => {
    const events = renderEvents(null, sample({ outcome: 'full', tally: '{"raster":{"n":3,"ms":4.5},"body":{"n":0,"ms":0}}' }));

    expect(events.join()).toContain('raster=3/4.5ms');
    expect(events.join()).not.toContain('body');
  });

  it('reports evictions when the cache shrinks and settle when pending clears', () => {
    const events = renderEvents(sample({ cacheBytes: 500, pending: true }), sample({ cacheBytes: 200 }));

    expect(events.join('\n')).toContain('evicted 300B');
    expect(events.join('\n')).toContain('settled');
  });

  it('stays silent for an unchanged idle frame', () => {
    expect(renderEvents(sample({}), sample({}))).toEqual([]);
  });
});

describe('when on', () => {
  it('logs tier switches once per change', () => {
    vi.stubGlobal('localStorage', { getItem: () => '1' });
    const out = sink();
    const timers: (() => void)[] = [];
    vi.stubGlobal('setTimeout', (f: () => void) => timers.push(f));
    debugStart('', out);

    tierLog('256', 0.1);
    tierLog('256', 0.2);
    tierLog('1024', 0.5);

    timers.forEach((f) => f());

    expect(out.lines.filter((l) => l.includes('[images]'))).toHaveLength(2);
    expect(out.lines.join()).toContain('tier 256 -> 1024');
  });

  it('logs gesture start and long frames with the gesture name', () => {
    vi.stubGlobal('localStorage', { getItem: () => '1' });
    const out = sink();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    const timers: (() => void)[] = [];
    vi.stubGlobal('setTimeout', (f: () => void) => timers.push(f));
    debugStart('', out);

    gestureLog('zoom');
    frames[0](100);
    frames[1](150);
    timers.forEach((f) => f());

    expect(out.lines.some((l) => l.includes('zoom start'))).toBe(true);
    expect(out.lines.some((l) => l.includes('long frame 50ms during zoom'))).toBe(true);
  });
});
