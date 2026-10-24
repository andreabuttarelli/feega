import { describe, expect, it } from 'vitest';
import { Horizontal, Vertical, setConstraints } from './constraints/constraints';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { FRAME_PRESETS, FramePreset, PRESET_SIZE, applyPreset, presetOf } from './frame-presets';
import { pivotBox } from './parent';
import { addClip, type OpResult } from './timeline';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const pinned = () => {
  const base = { ...newMotionDoc(MotionFormat.Custom), width: 1440, height: 1024, freeSize: true };
  const doc = ok(addClip(base, { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.9, y: 0.05, width: 0.05, height: 0.05 } }, 'badge'));
  return ok(setConstraints(doc, ['badge'], { horizontal: Horizontal.Right, vertical: Vertical.Top }));
};

describe('frame presets', () => {
  it('lists device, paper and social sizes', () => {
    expect(FRAME_PRESETS).toEqual([FramePreset.Phone, FramePreset.Tablet, FramePreset.Desktop, FramePreset.Presentation, FramePreset.Watch, FramePreset.Paper, FramePreset.Social]);
    expect(PRESET_SIZE[FramePreset.Phone]).toEqual({ width: 393, height: 852 });
    expect(PRESET_SIZE[FramePreset.Desktop]).toEqual({ width: 1440, height: 1024 });
  });

  it('sets the frame to the preset size', () => {
    const doc = ok(applyPreset(pinned(), FramePreset.Phone));

    expect([doc.width, doc.height]).toEqual([393, 852]);
    expect(presetOf(doc)).toBe(FramePreset.Phone);
  });

  it('keeps a layer pinned to the right edge at the same distance', () => {
    const before = pivotBox(findClip(pinned(), 'badge')!.clip.props, pinned());
    const resized = ok(applyPreset(pinned(), FramePreset.Phone));
    const after = pivotBox(findClip(resized, 'badge')!.clip.props, resized);

    expect(resized.width - (after.left + after.width)).toBeCloseTo(1440 - (before.left + before.width), 3);
    expect(after.width).toBeCloseTo(before.width, 3);
  });

  it('a custom size matches no preset', () => {
    expect(presetOf({ width: 500, height: 500 })).toBeNull();
  });
});
