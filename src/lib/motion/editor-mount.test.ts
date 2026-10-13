import { describe, expect, it } from 'vitest';
import { MOUNT, Mount, timelineFits } from './editor-mount';
import { MotionFormat, newMotionDoc } from './doc';

describe('editor mount', () => {
  it('the page owns the tab title and never closes; the canvas closes and leaves the title alone', () => {
    expect(MOUNT[Mount.Page]).toEqual({ ownsTitle: true, closes: false });
    expect(MOUNT[Mount.Canvas]).toEqual({ ownsTitle: false, closes: true });
  });

  it('a video has a timeline, a single-frame still does not', () => {
    const video = newMotionDoc(MotionFormat.Landscape);

    expect(timelineFits(video)).toBe(true);
    expect(timelineFits({ ...video, durationInFrames: 1 })).toBe(false);
  });
});
