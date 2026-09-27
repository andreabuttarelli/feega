import { describe, expect, it } from 'vitest';
import { encoderConfigFor, frameCount, frameTimestampsS, outputSizeFor } from './export';

describe('frameCount', () => {
  it('rounds duration × fps to the nearest frame', () => {
    expect(frameCount(3, 30)).toBe(90);
    expect(frameCount(2.5, 24)).toBe(60);
  });

  it('exports at least one frame even for a near-zero duration', () => {
    expect(frameCount(0.01, 30)).toBe(1);
  });
});

describe('frameTimestampsS', () => {
  it('maps frame index to seconds at the given fps', () => {
    expect(frameTimestampsS(3, 2)).toEqual([0, 0.5, 1]);
  });

  it('is empty for zero frames', () => {
    expect(frameTimestampsS(0, 30)).toEqual([]);
  });
});

describe('outputSizeFor', () => {
  it('sizes 9:16 at 720p as 720×1280', () => {
    expect(outputSizeFor('9:16', '720p')).toEqual({ width: 720, height: 1280 });
  });

  it('sizes 9:16 at 1080p as 1080×1920', () => {
    expect(outputSizeFor('9:16', '1080p')).toEqual({ width: 1080, height: 1920 });
  });

  it('sizes 1:1 at 1080p as 1080×1080', () => {
    expect(outputSizeFor('1:1', '1080p')).toEqual({ width: 1080, height: 1080 });
  });

  it('sizes 16:9 at 1080p as 1920×1080', () => {
    expect(outputSizeFor('16:9', '1080p')).toEqual({ width: 1920, height: 1080 });
  });

  it('sizes 16:9 at 720p as 1280×720', () => {
    expect(outputSizeFor('16:9', '720p')).toEqual({ width: 1280, height: 720 });
  });
});

describe('encoderConfigFor', () => {
  it('builds an avc1 config sized and bitrated for the output', () => {
    const config = encoderConfigFor({ width: 1080, height: 1920 }, 30);
    expect(config.codec).toBe('avc1.640028');
    expect(config.width).toBe(1080);
    expect(config.height).toBe(1920);
    expect(config.framerate).toBe(30);
    expect(config.bitrate).toBeGreaterThan(0);
  });

  it('scales bitrate with resolution, more pixels cost more bits', () => {
    const small = encoderConfigFor({ width: 720, height: 1280 }, 30);
    const large = encoderConfigFor({ width: 1080, height: 1920 }, 30);
    expect(large.bitrate).toBeGreaterThan(small.bitrate);
  });
});
