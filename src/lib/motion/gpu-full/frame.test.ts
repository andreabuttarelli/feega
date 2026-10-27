import { describe, expect, it } from 'vitest';
import { frameAt } from '@feega/motion-core/motion/gpu-full/frame';

describe('the frame shown at a time', () => {
  it('rounds to the nearest frame', () => {
    expect(frameAt(1.016, 30, 120)).toBe(30);
  });

  it('holds on the last frame once the video has ended, instead of an empty stage', () => {
    expect(frameAt(4, 30, 120)).toBe(119);
    expect(frameAt(9, 30, 120)).toBe(119);
  });
});
