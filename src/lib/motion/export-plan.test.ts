import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from './doc';
import { Resolution } from './render-quote';
import { AudioMode, Support, eta, exportSize, exportSupport, frameTimes, samplesPerFrame } from './export-plan';
import { BROWSER_SAMPLES } from './motion-blur';

describe('export plan', () => {
  it('1080p keeps the doc size, 720p scales it to an even size', () => {
    const vertical = newMotionDoc(MotionFormat.Vertical);
    const portrait = newMotionDoc(MotionFormat.Portrait);

    expect(exportSize(vertical, Resolution.P1080)).toEqual({ width: 1080, height: 1920 });
    expect(exportSize(vertical, Resolution.P720)).toEqual({ width: 720, height: 1280 });
    expect(exportSize(portrait, Resolution.P720)).toEqual({ width: 720, height: 900 });
  });

  it('one frame every 1/30 s, for the whole length', () => {
    const doc = { ...newMotionDoc(MotionFormat.Square), durationInFrames: 3 };

    expect(frameTimes(doc)).toEqual([0, 1 / 30, 2 / 30]);
  });

  it('with motion blur the browser captures a few samples per frame, inside the shutter', () => {
    const doc = { ...newMotionDoc(MotionFormat.Square), durationInFrames: 2, motionBlur: { enabled: true, shutterAngle: 180, shutterPhase: -90, samples: 8 } };
    const times = frameTimes(doc);

    expect(samplesPerFrame(doc)).toBe(BROWSER_SAMPLES);
    expect(times).toHaveLength(2 * BROWSER_SAMPLES);
    expect(times[2] * 30).toBeGreaterThan(0.75);
    expect(times[3] * 30).toBeLessThan(1.25);
  });

  it('the ETA comes from the frames already done', () => {
    expect(eta({ done: 10, total: 100, elapsedMs: 2000 })).toBe(18);
    expect(eta({ done: 0, total: 100, elapsedMs: 0 })).toBeNull();
  });

  it('without WebCodecs nothing can be exported', () => {
    expect(exportSupport({ webCodecs: false, h264: false, h264At720: false, aac: false })).toEqual({ support: Support.None, audio: AudioMode.Off });
  });

  it('without an AAC encoder the video exports silent, and says so', () => {
    expect(exportSupport({ webCodecs: true, h264: true, h264At720: true, aac: false })).toEqual({ support: Support.Full, audio: AudioMode.Unavailable });
    expect(exportSupport({ webCodecs: true, h264: true, h264At720: true, aac: true })).toEqual({ support: Support.Full, audio: AudioMode.On });
  });

  it('without H.264 at 1080p, 720p is the fallback', () => {
    expect(exportSupport({ webCodecs: true, h264: false, h264At720: true, aac: true }).support).toBe(Support.Only720);
    expect(exportSupport({ webCodecs: true, h264: false, h264At720: false, aac: true }).support).toBe(Support.None);
  });
});
