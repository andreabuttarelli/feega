import { describe, expect, it } from 'vitest';
import type { MotionClip, MotionDoc } from '$lib/motion/doc';
import { DrawTool } from '$lib/motion/draw-tool';
import { AlignSide, FrameOverlay, activeAt, alignSide, shownOverlays } from './frame-tools';

const clip = (patch: Partial<MotionClip> & { props?: Record<string, unknown> }): MotionClip => ({ id: 'c', from: 10, durationInFrames: 20, component: 'Shape', props: { shape: 'rect' }, ...patch }) as MotionClip;
const doc = { layoutGuides: [{ id: 'g' }] } as unknown as MotionDoc;
const plain = { doc: { layoutGuides: [] } as unknown as MotionDoc, clip: null, picks: 0, tool: DrawTool.Select, pointEdit: null, active: false };

describe('shownOverlays', () => {
  it('shows nothing for an empty selection with the select tool', () => {
    expect([...shownOverlays(plain)]).toEqual([]);
  });

  it('shows the draw overlay whenever a draw tool is on', () => {
    expect(shownOverlays({ ...plain, tool: DrawTool.Pen }).has(FrameOverlay.Draw)).toBe(true);
  });

  it('shows the guides the doc carries', () => {
    expect(shownOverlays({ ...plain, doc }).has(FrameOverlay.Guides)).toBe(true);
  });

  it('shows align from two picks', () => {
    expect(shownOverlays({ ...plain, picks: 1 }).has(FrameOverlay.Align)).toBe(false);
    expect(shownOverlays({ ...plain, picks: 2 }).has(FrameOverlay.Align)).toBe(true);
  });

  it('shows the mask of a masked clip that is on screen', () => {
    const masked = clip({ mask: { kind: 'rect' } as never });
    expect(shownOverlays({ ...plain, clip: masked, picks: 1, active: true }).has(FrameOverlay.Mask)).toBe(true);
    expect(shownOverlays({ ...plain, clip: masked, picks: 1, active: false }).has(FrameOverlay.Mask)).toBe(false);
  });

  it('shows pen points for a path being edited and vector points for a vector', () => {
    const path = clip({ props: { shape: 'path' } });
    const vector = clip({ props: { shape: 'vector' } });
    expect([...shownOverlays({ ...plain, clip: path, picks: 1, pointEdit: 'c', active: true })]).toEqual([FrameOverlay.Pen]);
    expect([...shownOverlays({ ...plain, clip: vector, picks: 1, pointEdit: 'c', active: true })]).toEqual([FrameOverlay.Vector]);
  });

  it('hides point editing once the clip is not the one being edited', () => {
    const path = clip({ props: { shape: 'path' } });
    expect(shownOverlays({ ...plain, clip: path, picks: 1, pointEdit: 'other', active: true }).has(FrameOverlay.Pen)).toBe(false);
  });

  it('shows auto-layout strips and the text path of the single pick', () => {
    const laid = clip({ autoLayout: { direction: 'row' } as never, textPath: { d: 'M0 0' } as never });
    const got = shownOverlays({ ...plain, clip: laid, picks: 1, active: true });
    expect(got.has(FrameOverlay.AutoLayout)).toBe(true);
    expect(got.has(FrameOverlay.TextPath)).toBe(true);
  });
});

describe('activeAt', () => {
  it('is true only while the playhead is inside the clip', () => {
    expect(activeAt(clip({}), 9)).toBe(false);
    expect(activeAt(clip({}), 10)).toBe(true);
    expect(activeAt(clip({}), 29)).toBe(true);
    expect(activeAt(clip({}), 30)).toBe(false);
  });
});

describe('alignSide', () => {
  const clear = { width: 1100, bottom: 567 };

  it('puts the align bar under a frame with room below it', () => {
    expect(alignSide({ left: 100, top: 100, width: 400, height: 200 }, clear)).toBe(AlignSide.Below);
  });

  it('moves the align bar beside a frame whose bottom sits on the canvas bar', () => {
    expect(alignSide({ left: 345, top: 307, width: 420, height: 238 }, clear)).toBe(AlignSide.Right);
  });

  it('puts the align bar over a frame with no room below or beside it', () => {
    expect(alignSide({ left: 0, top: 307, width: 1000, height: 238 }, clear)).toBe(AlignSide.Above);
  });
});
