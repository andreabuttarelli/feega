import { describe, expect, it } from 'vitest';
import { MIXED, RunToggle, codeIndex, normalRuns, rangeValues, runEditSchema, runAt, runsSchema, segmentsOf, shiftRuns, styledRange } from './text-runs';

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

  it('a range carries family, size, spacing, decoration, case and opacity too', () => {
    const runs = styledRange([], { start: 0, end: 3 }, { font: 'Inter', size: 0.2, tracking: 0.1, leading: 1.5, underline: RunToggle.Underline, textCase: 'upper', opacity: 0.5 }, 5);
    expect(runs).toEqual([{ start: 0, end: 3, font: 'Inter', size: 0.2, tracking: 0.1, leading: 1.5, underline: true, textCase: 'upper', opacity: 0.5 }]);
    expect(styledRange(runs, { start: 0, end: 3 }, { underline: RunToggle.Underline }, 5)[0].underline).toBeUndefined();
  });

  it('an agent edit takes any style field, null clearing it', () => {
    expect(runEditSchema.parse({ size: 0.2, color: null })).toEqual({ size: 0.2, color: null });
    expect(runEditSchema.safeParse({ size: 9 }).success).toBe(false);
  });

  it('reads a range as one value per style, or mixed', () => {
    const runs = [{ start: 0, end: 2, size: 0.2 }];
    const base = { size: 0.1, weight: 400 };
    expect(rangeValues(runs, { start: 0, end: 2 }, base, 5).size).toBe(0.2);
    expect(rangeValues(runs, { start: 1, end: 4 }, base, 5).size).toBe(MIXED);
    expect(rangeValues(runs, { start: 1, end: 4 }, base, 5).weight).toBe(400);
  });

  it('turns a textarea caret offset into a code point offset', () => {
    expect(codeIndex('😀ab', 3)).toBe(2);
  });
});
