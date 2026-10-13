import { describe, expect, it } from 'vitest';
import { MOUNT, Measure, Mount, PART_DOCK, Part, Stage, Zoom, timelineFits } from './editor-mount';
import { Viewport } from './editor-layout';
import { Dock } from '$lib/canvas/free-area';
import { MotionFormat, newMotionDoc } from './doc';

describe('editor mount', () => {
  it('the page owns the tab title, its stage and its zoom; never closes', () => {
    expect(MOUNT[Mount.Page]).toEqual({ ownsTitle: true, closes: false, stage: Stage.Own, zoom: Zoom.Stage, measure: Measure.Window });
  });

  it('on the canvas the preview plays in the node, the canvas zooms it, and the layout follows the room the canvas leaves, not the window', () => {
    expect(MOUNT[Mount.Canvas]).toEqual({ ownsTitle: false, closes: true, stage: Stage.Node, zoom: Zoom.Canvas, measure: Measure.Host });
  });

  it('a video has a timeline, a single-frame still does not', () => {
    const video = newMotionDoc(MotionFormat.Landscape);

    expect(timelineFits(video)).toBe(true);
    expect(timelineFits({ ...video, durationInFrames: 1 })).toBe(false);
  });
});

describe('where each part of the editor docks', () => {
  it('on a phone the transport and the sheets sit at the bottom, on wider screens the transport is in the top bar', () => {
    expect(PART_DOCK[Viewport.Phone][Part.Transport]).toBe(Dock.Timeline);
    expect(PART_DOCK[Viewport.Phone][Part.Panel]).toBe(Dock.Timeline);
    expect(PART_DOCK[Viewport.Tablet][Part.Transport]).toBe(Dock.TopBar);
    expect(PART_DOCK[Viewport.Desktop][Part.Panel]).toBe(Dock.RightPanel);
  });

  it('every viewport places every part', () => {
    for (const viewport of Object.values(Viewport)) {
      expect(Object.keys(PART_DOCK[viewport]).sort()).toEqual(Object.values(Part).sort());
    }
  });
});
