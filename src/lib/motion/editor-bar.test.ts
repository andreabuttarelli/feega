import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from './doc';
import { SAVE_TONE, SaveState, SaveTone, TimeDisplay, clockLabel, compositionLabel, compositionShort, nextDisplay } from './editor-bar';

describe('editor bar', () => {
  it('sums the composition up in one chip', () => {
    const doc = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 28 * 30 };

    expect(compositionLabel(doc)).toBe('16:9 · 1920×1080 · 30fps · 28s');
    expect(compositionShort(doc)).toBe('16:9 · 28s');
  });

  it('shows the clock as timecode, or as a frame count after a click', () => {
    expect(clockLabel(71, 30, TimeDisplay.Timecode)).toBe('00:02:11');
    expect(clockLabel(71, 30, TimeDisplay.Frames)).toBe('71');
    expect(nextDisplay(TimeDisplay.Timecode)).toBe(TimeDisplay.Frames);
    expect(nextDisplay(TimeDisplay.Frames)).toBe(TimeDisplay.Timecode);
  });

  it('gives every save state a tone, and only a failure is an error', () => {
    expect(SAVE_TONE[SaveState.Saved]).toBe(SaveTone.Done);
    expect(SAVE_TONE[SaveState.Saving]).toBe(SaveTone.Busy);
    expect(SAVE_TONE[SaveState.Pending]).toBe(SaveTone.Busy);
    expect(SAVE_TONE[SaveState.Failed]).toBe(SaveTone.Error);
    expect(Object.keys(SAVE_TONE)).toHaveLength(Object.keys(SaveState).length);
  });
});
