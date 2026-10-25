import { describe, expect, it } from 'vitest';
import { BROWSER_SAMPLES, DEFAULT_MOTION_BLUR, frameOfSample, motionBlurSchema, sampleTimes } from './motion-blur';

const on = { ...DEFAULT_MOTION_BLUR, enabled: true };

describe('motion blur', () => {
  it('is off by default, with the After Effects shutter: 180°, phase -90°, 8 samples', () => {
    expect(motionBlurSchema.parse(undefined)).toEqual({ enabled: false, shutterAngle: 180, shutterPhase: -90, samples: 8 });
  });

  it('off renders each frame once, at its own time', () => {
    expect(sampleTimes(10, 30, DEFAULT_MOTION_BLUR)).toEqual([10 / 30]);
  });

  it('a 180° shutter samples half a frame, centred on the frame, evenly', () => {
    const times = sampleTimes(10, 30, on);
    const frames = times.map((t) => t * 30 - 10);

    expect(times).toHaveLength(8);
    expect(frames[0]).toBeCloseTo(-0.25 + 0.5 / 16);
    expect(frames[7]).toBeCloseTo(0.25 - 0.5 / 16);
    expect(frames.reduce((a, b) => a + b, 0)).toBeCloseTo(0);
  });

  it('the same frame always samples the same times', () => {
    expect(sampleTimes(42, 60, on)).toEqual(sampleTimes(42, 60, on));
  });

  it('the browser caps the samples it accumulates', () => {
    expect(sampleTimes(10, 30, on, BROWSER_SAMPLES)).toHaveLength(BROWSER_SAMPLES);
  });

  it('frame 0 never samples before the start', () => {
    expect(Math.min(...sampleTimes(0, 30, on))).toBeGreaterThanOrEqual(0);
  });

  it('a clip without blur holds its frame through every sample of the shutter', () => {
    for (const blur of [on, { ...on, shutterAngle: 360, shutterPhase: 0 }, { ...on, shutterAngle: 90, shutterPhase: 0 }]) {
      for (const t of sampleTimes(10, 30, blur)) {
        expect(frameOfSample(t, 30, blur)).toBe(10);
      }
    }
  });
});
