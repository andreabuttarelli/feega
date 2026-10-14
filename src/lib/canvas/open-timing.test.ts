import { describe, expect, it } from 'vitest';
import { OpenMark, openTiming, tapTime } from './open-timing';

describe('timing a frame opening on a real device', () => {
  it('reports every phase once, relative to the tap, when the first frame shows', () => {
    let now = 1000;
    const reports: unknown[] = [];
    const timing = openTiming({ tap: 900, now: () => now, report: (phases) => reports.push(phases) });

    now = 1300;
    timing.mark(OpenMark.Session);
    now = 1450;
    timing.mark(OpenMark.Chrome);
    timing.mark(OpenMark.Chrome);
    now = 2100;
    timing.mark(OpenMark.Ready);
    expect(reports).toEqual([]);
    now = 2140;
    timing.mark(OpenMark.Shown);
    timing.mark(OpenMark.Shown);
    timing.end();

    expect(reports).toEqual([{ outcome: 'shown', open_ms: 100, session_ms: 400, chrome_ms: 550, ready_ms: 1200, shown_ms: 1240 }]);
  });

  it('a closed editor reports what it reached, so slow opens nobody waits for still count', () => {
    let now = 0;
    const reports: unknown[] = [];
    const timing = openTiming({ tap: 0, now: () => now, report: (phases) => reports.push(phases) });
    now = 500;
    timing.mark(OpenMark.Session);
    now = 4000;
    timing.end();
    timing.end();

    expect(reports).toEqual([{ outcome: 'closed', open_ms: 0, session_ms: 500, chrome_ms: null, ready_ms: null, shown_ms: null }]);
  });

  it('times from the press that opened it, not from a press long before', () => {
    expect(tapTime(950, 1000)).toBe(950);
    expect(tapTime(null, 1000)).toBe(1000);
    expect(tapTime(100, 5000)).toBe(5000);
  });
});
