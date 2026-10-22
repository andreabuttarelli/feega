import { describe, expect, it } from 'vitest';
import { timelineFits } from './editor-mount';
import { MotionFormat, newMotionDoc } from './doc';

describe('editor mount', () => {
  it('a video has a timeline, a single-frame still does not', () => {
    const video = newMotionDoc(MotionFormat.Landscape);

    expect(timelineFits(video)).toBe(true);
    expect(timelineFits({ ...video, durationInFrames: 1 })).toBe(false);
  });
});
