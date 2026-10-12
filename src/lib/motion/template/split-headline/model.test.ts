import { describe, expect, it } from 'vitest';
import { SPLIT_MODEL } from './model';

type Point = { x: number; y: number };
type Layout = { axis: string; fit: number; imgW: number; imgH: number; gap: number; space: number; cx: number };
type Word = { progress: number; rise: number; opacity: number };
type Frame = { open: number; image: Point & { w: number; h: number; zoom: number }; left: Point; right: Point; words: Word[]; times: { openAt: number; closeAt: number } };
type Measure = { leftW: number; rightW: number; space: number; frameW: number; frameH: number };
type Model = {
  splitWords: (text: string, at: number) => { left: string[]; right: string[] };
  splitLayout: (p: object, m: Measure) => Layout;
  splitFrame: (layout: Layout, p: object, t: number, length: number, words: number) => Frame;
};

const model = new Function(`${SPLIT_MODEL}; return { splitWords, splitLayout, splitFrame };`)() as Model;

const PARAMS = {
  splitAt: 0,
  imageHeight: 0.9,
  aspect: 1.5,
  gap: 0.22,
  grow: 'width',
  stack: 'auto',
  titleAt: 0.2,
  openDelay: 0.3,
  openSeconds: 1.4,
  easing: 'expo',
  innerZoom: true,
  zoomAmount: 0.25,
  holdSeconds: 2.5,
  closeSeconds: 1,
  leave: true
};
const MEASURE: Measure = { leftW: 3.6, rightW: 3.1, space: 0.25, frameW: 12.7, frameH: 7.1 };
const TALL: Measure = { ...MEASURE, frameW: 7.1, frameH: 12.7 };
const LENGTH = 8;
const FPS = 30;
const WORDS = 4;

const run = (p: object = PARAMS, m: Measure = MEASURE) => {
  const layout = model.splitLayout(p, m);
  const frames = Array.from({ length: LENGTH * FPS + 1 }, (_, i) => model.splitFrame(layout, p, i / FPS, LENGTH, WORDS));
  return { layout, frames };
};

describe('the split headline model', () => {
  it('splits at the middle word boundary by default, or where asked', () => {
    expect(model.splitWords('your story in motion', 0)).toEqual({ left: ['your', 'story'], right: ['in', 'motion'] });
    expect(model.splitWords('your story in motion', 3)).toEqual({ left: ['your', 'story', 'in'], right: ['motion'] });
    expect(model.splitWords('your story in motion', 9).right).toEqual(['motion']);
  });

  it('grows the image from nothing: zero width before it opens, full width once open', () => {
    const { layout, frames } = run();
    const opened = frames.find((f) => f.open === 1);

    expect(frames[0].image.w).toBe(0);
    expect(opened?.image.w).toBeCloseTo(layout.imgW, 9);
    frames.filter((_, i) => i / FPS < frames[0].times.openAt).forEach((f) => expect(f.image.w).toBe(0));
  });

  it('keeps the halves hugging the image edges on every frame', () => {
    const { layout, frames } = run();

    frames.forEach((f) => {
      const edge = f.image.w / 2;
      const gap = layout.gap * f.open + (layout.space / 2) * (1 - f.open);
      expect(f.right.x - (f.image.x + edge)).toBeCloseTo(gap, 9);
      expect(f.image.x - edge - f.left.x).toBeCloseTo(gap, 9);
    });
  });

  it('closes the halves to a normal word space when the image is shut', () => {
    const { layout, frames } = run();

    expect(frames[0].right.x - frames[0].left.x).toBeCloseTo(layout.space, 9);
  });

  it('keeps the whole line centred: the image sits where the halves balance', () => {
    const { layout } = run();

    expect(layout.cx).toBeCloseTo((MEASURE.leftW - MEASURE.rightW) / 2, 9);
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const layout = model.splitLayout(PARAMS, MEASURE);
    const at = [0.4, 2.1, 3.3, 6.2, 7.9];
    const forward = at.map((t) => model.splitFrame(layout, PARAMS, t, LENGTH, WORDS));
    const backward = [...at].reverse().map((t) => model.splitFrame(layout, PARAMS, t, LENGTH, WORDS)).reverse();

    expect(backward).toEqual(forward);
  });

  it('opens without overshoot: the image never grows past its full size', () => {
    const { layout, frames } = run();

    frames.forEach((f) => {
      expect(f.open).toBeGreaterThanOrEqual(0);
      expect(f.open).toBeLessThanOrEqual(1);
      expect(f.image.w).toBeLessThanOrEqual(layout.imgW + 1e-9);
    });
  });

  it('has no speed jumps: no frame changes speed by more than half the peak', () => {
    const { frames } = run(PARAMS);
    const steps = frames.slice(1).map((f, i) => f.image.w - frames[i].image.w);
    const jumps = steps.slice(1).map((s, i) => Math.abs(s - steps[i]));

    expect(Math.max(...jumps)).toBeLessThan(Math.max(...steps.map(Math.abs)) * 0.5);
  });

  it('closes the loop: the first and last frames are both the empty background', () => {
    const { frames } = run();
    const [first, last] = [frames[0], frames[frames.length - 1]];

    expect(first.open).toBe(0);
    expect(last.open).toBe(0);
    first.words.forEach((w) => expect(w.opacity).toBe(0));
    last.words.forEach((w) => expect(w.opacity).toBeCloseTo(0, 9));
  });

  it('without loop, stays open on the last frame', () => {
    const { frames } = run({ ...PARAMS, leave: false });
    const last = frames[frames.length - 1];

    expect(last.open).toBe(1);
    last.words.forEach((w) => expect(w.opacity).toBe(1));
  });

  it('enters the headline before the image starts opening', () => {
    const { frames } = run();
    const openAt = frames[0].times.openAt;
    const before = frames[Math.floor(openAt * FPS)];

    before.words.forEach((w) => expect(w.opacity).toBe(1));
  });

  it('zooms the picture inside the mask from the zoom amount down to rest, only when asked', () => {
    const { frames } = run();

    expect(frames[0].image.zoom).toBeCloseTo(1 + PARAMS.zoomAmount, 9);
    expect(frames.find((f) => f.open === 1)?.image.zoom).toBe(1);
    expect(run({ ...PARAMS, innerZoom: false }).frames.every((f) => f.image.zoom === 1)).toBe(true);
  });

  it('grows the height too when the image opens from zero size', () => {
    const { layout, frames } = run({ ...PARAMS, grow: 'size' });
    const half = frames.find((f) => f.open > 0.45 && f.open < 0.55);

    expect(frames[0].image.h).toBe(0);
    expect(half?.image.h).toBeCloseTo(layout.imgH * (half?.open ?? 0), 9);
  });

  it('stacks the halves above and below the image in a portrait frame', () => {
    const { layout, frames } = run(PARAMS, TALL);
    const open = frames.find((f) => f.open === 1);

    expect(layout.axis).toBe('column');
    expect(open?.image.h).toBeCloseTo(layout.imgH, 9);
    expect(open?.right.y).toBeCloseTo(layout.imgH / 2 + layout.gap + 0.5, 9);
    expect(open?.left.y).toBeCloseTo(-(layout.imgH / 2 + layout.gap + 0.5), 9);
  });

  it('scales the line to fit the frame width when the row is too wide', () => {
    const wide = { ...MEASURE, leftW: 7, rightW: 7 };
    const layout = model.splitLayout(PARAMS, wide);
    const total = (wide.leftW + wide.rightW + layout.imgW + 2 * layout.gap) * layout.fit;

    expect(layout.axis).toBe('row');
    expect(total).toBeLessThanOrEqual(wide.frameW * 0.88 + 1e-9);
  });
});
