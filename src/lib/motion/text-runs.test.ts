import { describe, expect, it } from 'vitest';
import { RunToggle, codeIndex, normalRuns, runAt, runsSchema, segmentsOf, shiftRuns, styledRange } from './text-runs';

describe('text runs', () => {
  it('an old text clip without runs still parses', () => {
    expect(runsSchema.parse(undefined)).toBeUndefined();
  });

  it('normalises: clamps to the text, drops empty runs, sorts, merges what overlaps by later winning', () => {
    const runs = normalRuns(
      [
        { start: 4, end: 20, color: '#ff0000' },
        { start: 0, end: 2, weight: 700 },
        { start: 3, end: 3, italic: true }
      ],
      10
    );
    expect(runs).toEqual([
      { start: 0, end: 2, weight: 700 },
      { start: 4, end: 10, color: '#ff0000' }
    ]);
  });

  it('styling a range splits the runs it crosses and keeps their other styles', () => {
    const runs = styledRange([{ start: 0, end: 10, color: '#ff0000' }], { start: 2, end: 5 }, { weight: 700 }, 10);
    expect(runs).toEqual([
      { start: 0, end: 2, color: '#ff0000' },
      { start: 2, end: 5, color: '#ff0000', weight: 700 },
      { start: 5, end: 10, color: '#ff0000' }
    ]);
  });

  it('bold toggles off when the whole range is already bold', () => {
    const bold = styledRange([], { start: 0, end: 4 }, { weight: RunToggle.Bold }, 8);
    expect(bold).toEqual([{ start: 0, end: 4, weight: 700 }]);
    expect(styledRange(bold, { start: 0, end: 4 }, { weight: RunToggle.Bold }, 8)).toEqual([]);
  });

  it('typing before a run moves it, typing inside grows it, deleting across shrinks it', () => {
    const runs = [{ start: 6, end: 11, weight: 700 }];
    expect(shiftRuns(runs, 'hello world', 'oh hello world')).toEqual([{ start: 9, end: 14, weight: 700 }]);
    expect(shiftRuns(runs, 'hello world', 'hello wonderful world'.slice(0, 15))).toEqual([{ start: 6, end: 15, weight: 700 }]);
    expect(shiftRuns(runs, 'hello world', 'hello d')).toEqual([{ start: 6, end: 7, weight: 700 }]);
    expect(shiftRuns(runs, 'hello world', 'hello ')).toEqual([]);
  });

  it('segments cover the text in order, each with its run or none', () => {
    expect(segmentsOf('abcdef', [{ start: 2, end: 4, italic: true }])).toEqual([
      { text: 'ab', run: null },
      { text: 'cd', run: { start: 2, end: 4, italic: true } },
      { text: 'ef', run: null }
    ]);
  });

  it('finds the run under a character', () => {
    const runs = [{ start: 2, end: 4, color: '#00ff00' }];
    expect(runAt(runs, 3)).toEqual(runs[0]);
    expect(runAt(runs, 4)).toBeNull();
  });

  it('counts code points, not UTF-16 units', () => {
    expect(segmentsOf('😀ab', [{ start: 1, end: 2, weight: 700 }])).toEqual([
      { text: '😀', run: null },
      { text: 'a', run: { start: 1, end: 2, weight: 700 } },
      { text: 'b', run: null }
    ]);
  });

  it('turns a textarea caret offset into a code point offset', () => {
    expect(codeIndex('😀ab', 3)).toBe(2);
  });
});
