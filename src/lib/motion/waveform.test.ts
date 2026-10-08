import { describe, expect, it } from 'vitest';
import { clipPeaks, wavePath, PEAKS_PER_SECOND } from './waveform';

describe('waveform', () => {
  it('a clip shows the slice of the file it plays, from its trim', () => {
    const peaks = Array.from({ length: 4 * PEAKS_PER_SECOND }, (_, i) => i);
    const slice = clipPeaks(peaks, { trimStart: 30, durationInFrames: 30, fps: 30 });

    expect(slice[0]).toBe(PEAKS_PER_SECOND);
    expect(slice).toHaveLength(PEAKS_PER_SECOND);
  });

  it('draws one filled, centred bar per peak, as tall as the peak, so a fill shows it', () => {
    expect(wavePath([1, 0.5])).toBe('M0 0h0.8V1h-0.8ZM1 0.25h0.8V0.75h-0.8Z');
    expect(wavePath([])).toBe('');
  });
});
