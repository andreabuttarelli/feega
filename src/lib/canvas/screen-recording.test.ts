import { describe, expect, it } from 'vitest';
import { RECORD_MAX_SECONDS, clockLabel, cropOf, recordingFileName, videoMime } from './screen-recording';

describe('screen recording', () => {
  it('caps a recording at 60 seconds', () => {
    expect(RECORD_MAX_SECONDS).toBe(60);
  });

  it('prefers mp4, then vp9 webm, then any webm', () => {
    expect(videoMime(() => true)).toBe('video/mp4;codecs=avc1');
    expect(videoMime((m) => m.startsWith('video/webm'))).toBe('video/webm;codecs=vp9,opus');
    expect(videoMime((m) => m === 'video/webm')).toBe('video/webm');
    expect(videoMime(() => false)).toBe('');
  });

  it('names the file after the container, not the codec list', () => {
    const at = new Date('2026-11-17T10:20:30Z');

    expect(recordingFileName(at, 'video/mp4;codecs=avc1')).toBe('canvas-recording-2026-11-17-102030.mp4');
    expect(recordingFileName(at, 'video/webm;codecs=vp9,opus')).toBe('canvas-recording-2026-11-17-102030.webm');
    expect(recordingFileName(at, '')).toBe('canvas-recording-2026-11-17-102030.webm');
  });

  it('crops the area in source pixels and keeps it inside the source', () => {
    expect(cropOf({ x: 100, y: 50, width: 400, height: 300 }, { width: 1440, height: 900 }, 2)).toEqual({ sx: 200, sy: 100, sw: 800, sh: 600 });
    expect(cropOf({ x: -20, y: -10, width: 5000, height: 5000 }, { width: 1440, height: 900 }, 1)).toEqual({ sx: 0, sy: 0, sw: 1440, sh: 900 });
  });

  it('rounds the crop to even sizes, which video encoders need', () => {
    const c = cropOf({ x: 0, y: 0, width: 333, height: 201 }, { width: 1440, height: 900 }, 1);

    expect(c.sw % 2).toBe(0);
    expect(c.sh % 2).toBe(0);
  });

  it('shows the clock as m:ss', () => {
    expect(clockLabel(0)).toBe('0:00');
    expect(clockLabel(9.9)).toBe('0:09');
    expect(clockLabel(61)).toBe('1:01');
  });
});
