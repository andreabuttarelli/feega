import { describe, expect, it } from 'vitest';
import { parseSize, proxyArgs, proxyPathOf, wantsProxy } from './video-proxy';

describe('wantsProxy', () => {
  it('proxies 4K and 1440p, landscape or portrait', () => {
    expect(wantsProxy({ width: 3840, height: 2160 })).toBe(true);
    expect(wantsProxy({ width: 2560, height: 1440 })).toBe(true);
    expect(wantsProxy({ width: 2160, height: 3840 })).toBe(true);
  });

  it('leaves 1080p and below alone', () => {
    expect(wantsProxy({ width: 1920, height: 1080 })).toBe(false);
    expect(wantsProxy({ width: 1280, height: 720 })).toBe(false);
  });
});

describe('proxyPathOf', () => {
  it('sits next to the original', () => {
    expect(proxyPathOf('org/proj/abc-clip.mov')).toBe('org/proj/abc-clip.mov.proxy.mp4');
  });
});

describe('proxyArgs', () => {
  const args = proxyArgs('in.mov', 'out.mp4').join(' ');

  it('encodes H.264 with the long edge at 960px', () => {
    expect(args).toContain('-c:v libx264');
    expect(args).toContain('960');
  });

  it('puts a keyframe every half second so a scrub lands close', () => {
    expect(args).toMatch(/-g \d+/);
  });
});

describe('parseSize', () => {
  it('reads the video stream size from ffmpeg output', () => {
    const log = '  Stream #0:0(und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709), 3840x2160 [SAR 1:1 DAR 16:9], 60 fps';
    expect(parseSize(log)).toEqual({ width: 3840, height: 2160 });
  });

  it('answers null when there is no video stream', () => {
    expect(parseSize('Stream #0:0: Audio: aac, 48000 Hz')).toBeNull();
  });
});
