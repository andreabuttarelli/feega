import { describe, expect, it } from 'vitest';
import { MOUNT, Mount, Stage, Zoom, timelineFits } from './editor-mount';
import { MotionFormat, newMotionDoc } from './doc';

describe('editor mount', () => {
  it('the page owns the tab title, its stage and its zoom; never closes', () => {
    expect(MOUNT[Mount.Page]).toEqual({ ownsTitle: true, closes: false, stage: Stage.Own, zoom: Zoom.Stage });
  });

  it('on the canvas the preview plays in the node, and the canvas zooms it', () => {
    expect(MOUNT[Mount.Canvas]).toEqual({ ownsTitle: false, closes: true, stage: Stage.Node, zoom: Zoom.Canvas });
  });

  it('a video has a timeline, a single-frame still does not', () => {
    const video = newMotionDoc(MotionFormat.Landscape);

    expect(timelineFits(video)).toBe(true);
    expect(timelineFits({ ...video, durationInFrames: 1 })).toBe(false);
  });
});
