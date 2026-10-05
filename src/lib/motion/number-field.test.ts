import { describe, expect, it } from 'vitest';
import { Nudge, Precision, clockText, fillShare, formatValue, nudged, parseClock, precisionOf, scrubbed } from './number-field';

const opacity = { min: 0, max: 1, step: 0.01 };
const rotation = { min: -1080, max: 1080, step: 1 };

describe('number field', () => {
  it('scrubs one step per pixel, ten with Shift, a tenth with Alt', () => {
    expect(scrubbed(0, 12, rotation, Precision.Normal)).toBe(12);
    expect(scrubbed(0, 12, rotation, Precision.Coarse)).toBe(120);
    expect(scrubbed(0, 12, rotation, Precision.Fine)).toBe(1.2);
  });

  it('never scrubs past the range, and lands on clean numbers', () => {
    expect(scrubbed(0.5, 900, opacity, Precision.Normal)).toBe(1);
    expect(scrubbed(0.5, -900, opacity, Precision.Normal)).toBe(0);
    expect(scrubbed(0.1, 2, opacity, Precision.Normal)).toBe(0.12);
  });

  it('nudges with the arrow keys', () => {
    expect(nudged(10, Nudge.Up, Precision.Normal, rotation)).toBe(11);
    expect(nudged(10, Nudge.Down, Precision.Coarse, rotation)).toBe(0);
  });

  it('reads Shift and Alt as the precision of a gesture', () => {
    expect(precisionOf({ shiftKey: true, altKey: false })).toBe(Precision.Coarse);
    expect(precisionOf({ shiftKey: false, altKey: true })).toBe(Precision.Fine);
    expect(precisionOf({ shiftKey: false, altKey: false })).toBe(Precision.Normal);
  });

  it('shows as many decimals as the step asks for', () => {
    expect(formatValue(0.5, 0.01)).toBe('0.50');
    expect(formatValue(12.4, 1)).toBe('12');
  });

  it('fills the field in proportion to the range', () => {
    expect(fillShare(0.25, opacity)).toBe(0.25);
    expect(fillShare(4, opacity)).toBe(1);
  });

  it('writes and reads time as seconds:frames, like the timecode', () => {
    expect(clockText(279, 30)).toBe('09:09');
    expect(parseClock('3:06', 30)).toBe(96);
    expect(parseClock('45f', 30)).toBe(45);
    expect(parseClock('1.5', 30)).toBe(45);
    expect(parseClock('soon', 30)).toBeNull();
  });
});
