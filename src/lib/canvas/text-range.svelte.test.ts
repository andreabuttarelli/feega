import { describe, expect, it } from 'vitest';
import { MIXED } from '$lib/motion/text-runs';
import { TextRange } from './text-range.svelte';

describe('the text selection Properties edits while typing', () => {
  it('styles only the selected characters and reads them back, mixed when they differ', () => {
    const range = new TextRange();
    range.open({ clipId: 't', text: 'Hello world', runs: [], base: { size: 0.1, weight: 400 } });
    range.select({ start: 6, end: 11 });
    range.restyle({ size: 0.2 });

    expect(range.runs).toEqual([{ start: 6, end: 11, size: 0.2 }]);
    expect(range.values?.size).toBe(0.2);
    range.select({ start: 0, end: 11 });
    expect(range.values?.size).toBe(MIXED);
    expect(range.values?.weight).toBe(400);
  });

  it('keeps the styled characters while typing before them', () => {
    const range = new TextRange();
    range.open({ clipId: 't', text: 'ab', runs: [{ start: 1, end: 2, italic: true }], base: {} });
    range.retype('xab');
    expect(range.runs).toEqual([{ start: 2, end: 3, italic: true }]);
  });

  it('nothing selected: nothing to show, nothing styled', () => {
    const range = new TextRange();
    range.open({ clipId: 't', text: 'ab', runs: [], base: {} });
    range.restyle({ italic: true });
    expect(range.values).toBeNull();
    expect(range.runs).toEqual([]);
  });
});
