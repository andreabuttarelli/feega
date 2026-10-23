import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { setClipFlags } from './organize';
import { addClip, setProps, type OpResult } from './timeline';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const FRAME_WIDTH = 1920;
const FRAME_HEIGHT = 1080;

const box = () => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.1 } }, 'box'));
const sizeOf = (doc: MotionDoc) => {
  const { props } = findClip(doc, 'box')!.clip;
  return { w: Number(props.width) * FRAME_WIDTH, h: Number(props.height) * FRAME_HEIGHT };
};

describe('aspect lock', () => {
  const locked = () => must(setClipFlags(box(), 'box', { lockRatio: true }));

  it('a locked element keeps its pixel ratio when the width changes', () => {
    const before = sizeOf(locked());
    const after = sizeOf(must(setProps(locked(), 'box', { width: 0.4 })));

    expect(after.w / after.h).toBeCloseTo(before.w / before.h, 5);
    expect(after.w).toBeCloseTo(768, 5);
  });

  it('a locked element keeps its pixel ratio when the height changes', () => {
    const before = sizeOf(locked());
    const after = sizeOf(must(setProps(locked(), 'box', { height: 0.2 })));

    expect(after.w / after.h).toBeCloseTo(before.w / before.h, 5);
  });

  it('an unlocked element changes one side alone', () => {
    const after = sizeOf(must(setProps(box(), 'box', { width: 0.4 })));

    expect(after.h).toBeCloseTo(108, 5);
  });

  it('setting both sides in one edit is taken as asked', () => {
    const after = sizeOf(must(setProps(locked(), 'box', { width: 0.4, height: 0.3 })));

    expect(after.h).toBeCloseTo(324, 5);
  });
});
