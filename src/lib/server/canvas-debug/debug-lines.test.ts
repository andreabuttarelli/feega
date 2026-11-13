import { describe, expect, it } from 'vitest';
import { LINES_PER_SESSION, MAX_LINES_PER_BATCH, MAX_TEXT, REQUESTS_PER_USER_PER_MINUTE, createDebugGate, debugBatchOf, Verdict } from './debug-lines';

const line = (s: number, extra: object = {}) => ({ s, t: s * 250, k: 'sample', p: { zoom: 1.5, x: -20 }, ...extra });
const batch = (lines: unknown[], extra: object = {}) => JSON.stringify({ v: 1, session: 'abcd1234ef', canvas: 'c-1', lines, ...extra });

describe('a debug batch', () => {
  it('keeps session, canvas and every well formed line in order', () => {
    const parsed = debugBatchOf(batch([line(0), line(1)]));

    expect(parsed).toEqual({ session: 'abcd1234ef', canvas: 'c-1', lines: [{ seq: 0, t: 0, kind: 'sample', props: { zoom: 1.5, x: -20 } }, { seq: 1, t: 250, kind: 'sample', props: { zoom: 1.5, x: -20 } }] });
  });

  it('refuses a body that is not a batch of this version', () => {
    expect(debugBatchOf('nope')).toBeNull();
    expect(debugBatchOf(batch([line(0)], { v: 2 }))).toBeNull();
    expect(debugBatchOf(batch([line(0)], { session: 'x' }))).toBeNull();
    expect(debugBatchOf(batch([]))).toBeNull();
  });

  it('drops a line with a bad seq, time or kind and keeps the rest', () => {
    const parsed = debugBatchOf(batch([line(-1), line(1.5), line(2, { t: 'soon' }), line(3, { k: 'Not A Kind!' }), line(4)]));

    expect(parsed?.lines.map((l) => l.seq)).toEqual([4]);
  });

  it('truncates long text, drops functions of depth and caps the lines of one batch', () => {
    const deep = { a: { b: { c: { d: 1 } } } };
    const parsed = debugBatchOf(batch([line(0, { p: { stack: 'x'.repeat(MAX_TEXT * 3), deep, nan: 'NaN', list: [1, 2, 3] } }), ...Array.from({ length: MAX_LINES_PER_BATCH + 10 }, (_, i) => line(i + 1))]));

    const props = parsed!.lines[0].props as Record<string, unknown>;
    expect((props.stack as string).length).toBe(MAX_TEXT);
    expect(props.deep).toEqual({ a: { b: {} } });
    expect(props.nan).toBe('NaN');
    expect(props.list).toEqual([1, 2, 3]);
    expect(parsed!.lines).toHaveLength(MAX_LINES_PER_BATCH);
  });

  it('forgets a canvas id that is not an id', () => {
    expect(debugBatchOf(batch([line(0)], { canvas: 'x'.repeat(200) }))?.canvas).toBeNull();
  });
});

describe('the debug gate', () => {
  it('admits a user up to the per-minute limit, then refuses until the next minute', () => {
    let now = 0;
    const admit = createDebugGate(() => now);
    for (let i = 0; i < REQUESTS_PER_USER_PER_MINUTE; i++) {
      expect(admit('u1', `s${i}`, 1)).toBe(Verdict.Admit);
    }

    expect(admit('u1', 'sx', 1)).toBe(Verdict.TooMany);
    expect(admit('u2', 'sy', 1)).toBe(Verdict.Admit);
    now = 60_000;
    expect(admit('u1', 'sx', 1)).toBe(Verdict.Admit);
  });

  it('stops a session once it has sent its share of lines', () => {
    const admit = createDebugGate(() => 0);

    expect(admit('u1', 's', LINES_PER_SESSION - 1)).toBe(Verdict.Admit);
    expect(admit('u1', 's', 2)).toBe(Verdict.Full);
  });
});
