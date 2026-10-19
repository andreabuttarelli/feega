import { describe, expect, it } from 'vitest';
import { fitTexts, freeTextFit, keepTextSize, resizedTexts, resizedFreeText } from './text-fit';
import { setProps } from './timeline';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const text = (sizing: string) => ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'Hi', sizing, x: 0.5, y: 0.5, width: 0.2, height: 0.2 } }, 'tx'));

describe('texts that follow their words', () => {
  it('an auto-width text takes the box the preview measured', () => {
    const fitted = fitTexts(text('auto'), { tx: { left: 768, top: 432, width: 96, height: 54 } });
    expect(findClip(fitted!, 'tx')!.clip.props).toMatchObject({ width: 0.05, height: 0.05 });
  });

  it('nothing changes when every text already fits, so redraws settle', () => {
    expect(fitTexts(text('auto'), { tx: { left: 768, top: 432, width: 384, height: 216 } })).toBeNull();
    expect(fitTexts(text('fixed'), { tx: { left: 0, top: 0, width: 10, height: 10 } })).toBeNull();
  });
});

describe('a free text is its own box', () => {
  const free = (sizing: string) => ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'Hi', sizing, x: 0.5, y: 0.5, width: 1, height: 1 } }, 'tx'));

  it('asks its host to take the measured share of the stage instead of moving the text inside', () => {
    expect(freeTextFit(free('auto'), { tx: { left: 0, top: 0, width: 960, height: 1080 } })).toEqual({ width: 0.5, height: 1 });
    expect(freeTextFit(free('auto-height'), { tx: { left: 0, top: 0, width: 1920, height: 540 } })).toEqual({ width: 1, height: 0.5 });
  });

  it('stays put when it fits or is fixed', () => {
    expect(freeTextFit(free('auto'), { tx: { left: 0, top: 0, width: 1920, height: 1080 } })).toBeNull();
    expect(freeTextFit(free('fixed'), { tx: { left: 0, top: 0, width: 10, height: 10 } })).toBeNull();
  });
});

describe('a text resized by hand', () => {
  const sizingOf = (d: MotionDoc) => findClip(d, 'tx')!.clip.props.sizing;

  it('switches to fixed when its height was dragged', () => {
    const before = text('auto-height');
    const after = ok(setProps(before, 'tx', { height: 0.4 }));
    expect(sizingOf(resizedTexts(before, after))).toBe('fixed');
  });

  it('auto width becomes auto height when only the width was dragged', () => {
    const before = text('auto');
    const after = ok(setProps(before, 'tx', { width: 0.4 }));
    expect(sizingOf(resizedTexts(before, after))).toBe('auto-height');
  });

  it('a free text follows a resize of its host the same way', () => {
    expect(sizingOf(resizedFreeText(text('auto'), { width: true, height: false })!)).toBe('auto-height');
    expect(sizingOf(resizedFreeText(text('auto'), { width: false, height: true })!)).toBe('fixed');
    expect(resizedFreeText(text('fixed'), { width: true, height: true })).toBeNull();
  });
});

describe('resizing the box around a free text', () => {
  it('keeps the letters the same size on the canvas when the short side changes', () => {
    const before = text('auto');
    const after = keepTextSize(before, { width: 400, height: 100 }, { width: 50, height: 100 });
    expect(findClip(after, 'tx')!.clip.props.size).toBeCloseTo(Number(findClip(before, 'tx')!.clip.props.size) * 2, 6);
  });

  it('leaves them alone when the short side is the same', () => {
    const before = text('auto');
    expect(keepTextSize(before, { width: 400, height: 100 }, { width: 300, height: 100 })).toBe(before);
  });
});

