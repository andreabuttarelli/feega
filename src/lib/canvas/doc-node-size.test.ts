import { describe, expect, it } from 'vitest';
import { MotionFormat } from '$lib/motion/doc';
import { FrameKind, docNodeSize, motionNodeSize } from './motion-node';

const page = { width: 1440, height: 900 };

describe('a frame node follows its doc canvas', () => {
  it('a frame with no size takes the stage width of its format and the doc aspect', () => {
    const w = motionNodeSize(MotionFormat.Custom).w;

    expect(docNodeSize({ kind: FrameKind.Frame, width: null, height: null }, page)).toEqual({ w, h: Math.round((w * 900) / 1440) });
  });

  it('a sized frame keeps its width and takes the new doc aspect', () => {
    expect(docNodeSize({ kind: FrameKind.Frame, width: 420, height: 236 }, { width: 390, height: 844 })).toEqual({ w: 420, h: 909 });
  });

  it('a frame already matching its doc is left alone', () => {
    expect(docNodeSize({ kind: FrameKind.Frame, width: 720, height: 450 }, page)).toBeNull();
  });

  it('an element or a group keeps the size the canvas gave it', () => {
    expect(docNodeSize({ kind: FrameKind.Element, width: 100, height: 100 }, page)).toBeNull();
    expect(docNodeSize({ kind: FrameKind.Group, width: 100, height: 100 }, page)).toBeNull();
  });
});
