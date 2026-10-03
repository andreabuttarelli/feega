import { describe, expect, it } from 'vitest';
import { clipPeaks, peaksOf, PEAKS_PER_SECOND } from './waveform';

describe('waveform', () => {
  it('a peak is the loudest absolute sample of its bucket', () => {
    const samples = new Float32Array([0, 0.5, -0.9, 0.1, 0.2, -0.3]);

    expect(peaksOf([samples], 3).map((p) => Math.round(p * 10) / 10)).toEqual([0.5, 0.9, 0.3]);
  });

  it('mixes channels by taking the louder one', () => {
    expect(peaksOf([new Float32Array([0.1, 0.1]), new Float32Array([-0.6, 0.2])], 2).map((p) => Math.round(p * 10) / 10)).toEqual([0.6, 0.2]);
  });

  it('a clip shows the slice of the file it plays, from its trim', () => {
    const peaks = Array.from({ length: 4 * PEAKS_PER_SECOND }, (_, i) => i);
    const slice = clipPeaks(peaks, { trimStart: 30, durationInFrames: 30, fps: 30 });

    expect(slice[0]).toBe(PEAKS_PER_SECOND);
    expect(slice).toHaveLength(PEAKS_PER_SECOND);
  });
});
