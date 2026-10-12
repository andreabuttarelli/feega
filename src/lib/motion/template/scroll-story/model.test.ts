import { describe, expect, it } from 'vitest';
import { STORY_MODEL } from './model';

type Slot = { y: number; opacity: number; on: boolean };
type Head = { kicker: Slot; index: Slot; lines: Slot[] };
type Picture = { x: number; y: number; w: number; h: number; shift: number };
type Frame = { chapter: number; progress: number; heads: Head[]; images: Picture[]; marks: number[]; grid: { v: number[]; h: number[] } };
type Swap = { outAt: number[]; inAt: number[] };
type Model = {
  storyFrame: (p: object, t: number, length: number, width: number, height: number) => Frame;
  swapPlan: (p: object, length: number) => Swap[];
  storyGrid: (p: object, width: number, height: number) => { xs: number[]; ys: number[]; col: number };
  chapterAt: (progress: number, count: number) => number;
};

const model = new Function(`${STORY_MODEL}; return { storyFrame, swapPlan, storyGrid, chapterAt };`)() as Model;

const PARAMS = {
  headline1: 'start with\nthe land',
  headline2: 'follow the\nlight in\nslowly',
  headline3: 'and keep\ngoing',
  kicker1: 'origin',
  kicker2: 'process',
  kicker3: 'arrival',
  columns: 12,
  rows: 8,
  margin: 0.04,
  imageSize: 0.42,
  imageRatio: 1.25,
  lane1: 0,
  lane2: 8,
  lane3: 1,
  speed1: 1.2,
  speed2: 1.7,
  speed3: 1.4,
  parallax: 0.08,
  swapStyle: 'mask-up',
  swapDuration: 0.9,
  swapStagger: 0.12,
  swapOverlap: 0.35,
  introAt: 0.3
};
const LENGTH = 12;
const FPS = 30;
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;
const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const settled = (s: Slot) => s.on && Math.abs(s.y) < 1e-6 && s.opacity === 1;
const hidden = (s: Slot) => !s.on;

describe('the scroll story model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.2, 3.9, 4.1, 7.5, 11.9];
    const forward = at.map((t) => model.storyFrame(PARAMS, t, LENGTH, 1920, 1080));
    const backward = [...at].reverse().map((t) => model.storyFrame(PARAMS, t, LENGTH, 1920, 1080)).reverse();

    expect(backward).toEqual(forward);
  });

  it('splits progress into three equal chapters', () => {
    expect([0, 0.33, 0.34, 0.66, 0.67, 1].map((u) => model.chapterAt(u, 3))).toEqual([0, 0, 1, 1, 2, 2]);
    expect(model.storyFrame(PARAMS, 3.9, LENGTH, 1920, 1080).chapter).toBe(0);
    expect(model.storyFrame(PARAMS, 4.1, LENGTH, 1920, 1080).chapter).toBe(1);
    expect(model.storyFrame(PARAMS, 8.1, LENGTH, 1920, 1080).chapter).toBe(2);
  });

  it('holds only the current chapter, line by line, away from a boundary', () => {
    [2, 6, 10].forEach((t, chapter) => {
      const f = model.storyFrame(PARAMS, t, LENGTH, 1920, 1080);

      f.heads.forEach((head, i) => {
        const slots = [head.kicker, head.index, ...head.lines];
        expect(slots.every(i === chapter ? settled : hidden)).toBe(true);
      });
    });
    expect(model.storyFrame(PARAMS, 6, LENGTH, 1920, 1080).heads[1].lines).toHaveLength(3);
  });

  it('swaps line by line: each line leaves after the one above it, and its successor follows it in', () => {
    const plan = model.swapPlan(PARAMS, LENGTH);

    expect(plan).toHaveLength(2);
    plan.forEach((swap, b) => {
      const boundary = ((b + 1) * LENGTH) / 3;
      swap.outAt.slice(1).forEach((at, j) => expect(at).toBeGreaterThan(swap.outAt[j]));
      swap.inAt.forEach((at, j) => expect(at).toBeGreaterThan(swap.outAt[j]));
      expect(swap.outAt[0]).toBeLessThan(boundary);
      expect(swap.inAt[swap.inAt.length - 1]).toBeGreaterThan(boundary - PARAMS.swapDuration);
    });
  });

  it('moves the old first line before the new last line, mid swap', () => {
    const [swap] = model.swapPlan(PARAMS, LENGTH);
    const mid = model.storyFrame(PARAMS, swap.inAt[3] - 0.01, LENGTH, 1920, 1080);

    expect(mid.heads[0].lines[0].y).toBeLessThan(-0.5);
    expect(mid.heads[1].lines[2].y).toBeCloseTo(1.1, 3);
  });

  it('drifts every image upward at its own speed', () => {
    const at = (t: number) => model.storyFrame(PARAMS, t, LENGTH, 1920, 1080).images;
    const [a, b] = [at(5), at(6)];
    const velocity = a.map((img, i) => b[i].y - img.y);

    velocity.forEach((v) => expect(v).toBeLessThan(0));
    expect(velocity[1] / velocity[0]).toBeCloseTo(PARAMS.speed2 / PARAMS.speed1, 6);
    expect(velocity[2] / velocity[0]).toBeCloseTo(PARAMS.speed3 / PARAMS.speed1, 6);
  });

  it.each(Object.entries(ASPECTS))('centres each image in frame at the middle of its chapter, on a grid column, in %s', (_, [width, height]) => {
    const grid = model.storyGrid(PARAMS, width, height);

    [2, 6, 10].forEach((t, i) => {
      const img = model.storyFrame(PARAMS, t, LENGTH, width, height).images[i];
      expect(img.y + img.h / 2).toBeCloseTo(height / 2, 3);
      expect(img.x).toBeGreaterThanOrEqual(grid.xs[0] - 1e-6);
      expect(img.x + img.w).toBeLessThanOrEqual(grid.xs[grid.xs.length - 1] + 1e-6);
      expect(grid.xs.some((x) => Math.abs(x - img.x) < 1e-6) || Math.abs(img.x + img.w - grid.xs[grid.xs.length - 1]) < 1e-6).toBe(true);
    });
  });

  it('enters each later image from below the frame and lets earlier ones leave above', () => {
    const start = model.storyFrame(PARAMS, 0, LENGTH, 1920, 1080).images;
    const end = model.storyFrame(PARAMS, LENGTH, LENGTH, 1920, 1080).images;

    expect(start[1].y).toBeGreaterThan(1080);
    expect(start[2].y).toBeGreaterThan(1080);
    expect(end[0].y + end[0].h).toBeLessThan(0);
    expect(end[1].y + end[1].h).toBeLessThan(0);
  });

  it.each(Object.entries(ASPECTS))('never jumps between frames in %s', (_, [width, height]) => {
    const frames = times().map((t) => model.storyFrame(PARAMS, t, LENGTH, width, height));
    const slots = (f: Frame) => f.heads.flatMap((h) => [h.kicker, h.index, ...h.lines]);
    const gridOf = (f: Frame) => [...f.grid.v, ...f.grid.h];

    frames.slice(1).forEach((f, i) => {
      const prev = frames[i];
      slots(f).forEach((s, k) => {
        expect(Math.abs(s.y - slots(prev)[k].y)).toBeLessThan(0.35);
        expect(Math.abs(s.opacity - slots(prev)[k].opacity)).toBeLessThan(0.35);
      });
      f.images.forEach((img, k) => expect(Math.abs(img.y - prev.images[k].y)).toBeLessThan(height * 0.03));
      f.marks.forEach((m, k) => expect(Math.abs(m - prev.marks[k])).toBeLessThan(0.2));
      gridOf(f).forEach((g, k) => expect(Math.abs(g - gridOf(prev)[k])).toBeLessThan(0.35));
    });
  });

  it('fades instead of masking when the swap style is fade', () => {
    const [swap] = model.swapPlan({ ...PARAMS, swapStyle: 'fade' }, LENGTH);
    const f = model.storyFrame({ ...PARAMS, swapStyle: 'fade' }, swap.outAt[2] + PARAMS.swapDuration / 2, LENGTH, 1920, 1080);

    expect(f.heads[0].lines[0].opacity).toBeGreaterThan(0);
    expect(f.heads[0].lines[0].opacity).toBeLessThan(1);
    expect(Math.abs(f.heads[0].lines[0].y)).toBeLessThan(0.2);
  });
});
