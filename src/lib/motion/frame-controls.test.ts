import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from './doc';
import { VideoControl, controlShown } from './still';

const video = newMotionDoc(MotionFormat.Landscape);
const still = { ...video, still: { frame: 0 } };

describe('which video controls a frame shows', () => {
  it('a still design frame shows no video control at all', () => {
    for (const control of Object.values(VideoControl)) {
      expect(controlShown(still, control)).toBe(false);
    }
  });

  it('a motion frame shows every video control', () => {
    for (const control of Object.values(VideoControl)) {
      expect(controlShown(video, control)).toBe(true);
    }
  });
});
