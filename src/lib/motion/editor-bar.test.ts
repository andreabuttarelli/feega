import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from './doc';
import { SAVE_TONE, SaveState, SaveTone, TimeDisplay, clockLabel, compositionLabel, compositionShort, DISPLAY_NAME, isTap } from './editor-bar';

describe('editor bar', () => {
  it('sums the composition up in one chip', () => {
    const doc = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 28 * 30 };

    expect(compositionLabel(doc)).toBe('16:9 · 1920×1080 · 30fps · 28s');
    expect(compositionShort(doc)).toBe('16:9 · 28s');
  });

  it('shows the clock as timecode or frames, each named in the clock menu', () => {
    expect(clockLabel(71, 30, TimeDisplay.Timecode)).toBe('00:02:11');
    expect(clockLabel(71, 30, TimeDisplay.Frames)).toBe('71');
    expect(Object.keys(DISPLAY_NAME)).toEqual(Object.values(TimeDisplay));
  });

  it('closes a popover on a tap, not on the start of a scroll', () => {
    expect(isTap({ x: 10, y: 10 }, { x: 13, y: 14 })).toBe(true);
    expect(isTap({ x: 10, y: 10 }, { x: 10, y: 40 })).toBe(false);
  });

  it('gives every save state a tone, and only a failure is an error', () => {
    expect(SAVE_TONE[SaveState.Saved]).toBe(SaveTone.Done);
    expect(SAVE_TONE[SaveState.Saving]).toBe(SaveTone.Busy);
    expect(SAVE_TONE[SaveState.Pending]).toBe(SaveTone.Busy);
    expect(SAVE_TONE[SaveState.Failed]).toBe(SaveTone.Error);
    expect(Object.keys(SAVE_TONE)).toHaveLength(Object.keys(SaveState).length);
  });
});
