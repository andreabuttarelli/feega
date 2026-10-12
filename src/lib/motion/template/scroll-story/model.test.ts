import { describe, expect, it } from 'vitest';
import { STORY_MODEL } from './model';

type Slot = { y: number; opacity: number; on: boolean };
type Head = { kicker: Slot; index: Slot; lines: Slot[] };
type Picture = { x: number; y: number; w: number; h: number; shift: number };
type Frame = { chapter: number; position: number; heads: Head[]; images: Picture[]; marks: number[] };
type Swap = { outAt: number[]; inAt: number[] };
type Phases = { holds: [number, number][]; moves: [number, number][] };
type Grid = { xs: number[]; ys: number[]; col: number };
type Model = {
  storyFrame: (p: object, t: number, length: number, width: number, height: number) => Frame;
  storyPhases: (p: object, length: number) => Phases;
  swapPlan: (p: object, length: number) => Swap[];
  storyGrid: (p: object, width: number, height: number) => Grid;
  headBox: (p: object, width: number, height: number) => { x: number; y: number; w: number; h: number };
};

const model = new Function(`${STORY_MODEL}; return { storyFrame, storyPhases, swapPlan, storyGrid, headBox };`)() as Model;

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
  fontSize: 9,
  imageSize: 0.42,
  imageRatio: 1.25,
  lane1: 0,
  lane2: 9,
  lane3: 1,
  speed1: 1,
  speed2: 1.4,
  speed3: 1.2,
  parallax: 0.06,
  holdSeconds: 1.6,
  moveSeconds: 3.6,
  easing: 'expo',
  idleDrift: 0,
  swapStyle: 'mask-up',
  swapDuration: 0.9,
  swapStagger: 0.12,
  swapOverlap: 0.35
};
const LENGTH = 12;
const FPS = 30;
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;
const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const settled = (s: Slot) => s.on && Math.abs(s.y) < 1e-6 && s.opacity === 1;
const hidden = (s: Slot) => !s.on;
const frame = (t: number, p: object = PARAMS, [w, h]: readonly number[] = ASPECTS.landscape) => model.storyFrame(p, t, LENGTH, w, h);
const middle = ([a, b]: [number, number]) => (a + b) / 2;
const apart = (a: Picture, b: { x: number; y: number; w: number; h: number }) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

describe('the scroll story model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.2, 3.9, 4.1, 7.5, 11.9];
    const forward = at.map((t) => frame(t));
    const backward = [...at].reverse().map((t) => frame(t)).reverse();

    expect(backward).toEqual(forward);
  });

  it('cuts the length into hold, move, hold, move, hold, scaled to fit', () => {
    const { holds, moves } = model.storyPhases(PARAMS, LENGTH);
    const edges = [holds[0], moves[0], holds[1], moves[1], holds[2]];

    expect(edges[0][0]).toBe(0);
    expect(edges[4][1]).toBeCloseTo(LENGTH, 9);
    edges.slice(1).forEach((e, i) => expect(e[0]).toBeCloseTo(edges[i][1], 9));
    expect(moves[0][1] - moves[0][0]).toBeCloseTo((PARAMS.moveSeconds / PARAMS.holdSeconds) * (holds[0][1] - holds[0][0]), 9);
  });

  it('holds still on each chapter: only its headline, its image at rest, nothing moving', () => {
    const { holds } = model.storyPhases(PARAMS, LENGTH);

    holds.forEach((hold, chapter) => {
      const [a, b] = [frame(hold[0] + 0.05), frame(hold[1] - 0.05)];
      expect(b.images).toEqual(a.images);
      expect(a.chapter).toBe(chapter);
      expect(a.position).toBe(chapter);
      a.heads.forEach((head, i) => expect([head.kicker, head.index, ...head.lines].every(i === chapter ? settled : hidden)).toBe(true));
    });
  });

  it('swaps the headline line by line inside each move', () => {
    const { moves } = model.storyPhases(PARAMS, LENGTH);
    const plan = model.swapPlan(PARAMS, LENGTH);

    plan.forEach((swap, b) => {
      swap.outAt.slice(1).forEach((at, j) => expect(at).toBeGreaterThan(swap.outAt[j]));
      swap.inAt.forEach((at, j) => expect(at).toBeGreaterThan(swap.outAt[j]));
      expect(swap.outAt[0]).toBeGreaterThanOrEqual(moves[b][0]);
      expect(swap.inAt[swap.inAt.length - 1] + PARAMS.swapDuration).toBeLessThanOrEqual(moves[b][1]);
    });
  });

  it('moves the old first line before the new last line, mid swap', () => {
    const [swap] = model.swapPlan(PARAMS, LENGTH);
    const mid = frame(swap.inAt[3] - 0.01);

    expect(mid.heads[0].lines[0].y).toBeLessThan(-0.5);
    expect(mid.heads[1].lines[2].y).toBeCloseTo(1.1, 3);
  });

  it('moves every image upward at its own speed during a move, all arriving together', () => {
    const { moves } = model.storyPhases(PARAMS, LENGTH);
    const [a, b] = [frame(middle(moves[0]) - 0.2).images, frame(middle(moves[0]) + 0.2).images];
    const dy = a.map((img, i) => b[i].y - img.y);

    dy.forEach((d) => expect(d).toBeLessThan(0));
    expect(dy[1] / dy[0]).toBeCloseTo(PARAMS.speed2 / PARAMS.speed1, 6);
    expect(dy[2] / dy[0]).toBeCloseTo(PARAMS.speed3 / PARAMS.speed1, 6);
  });

  it.each(Object.entries(ASPECTS))('rests each image on the grid, clear of the headline and the label rows, in %s', (_, size) => {
    const [width, height] = size;
    const grid = model.storyGrid(PARAMS, width, height);
    const head = model.headBox(PARAMS, width, height);
    const { holds } = model.storyPhases(PARAMS, LENGTH);

    holds.forEach((hold, i) => {
      const img = frame(middle(hold), PARAMS, size).images[i];
      expect(apart(img, head)).toBe(true);
      expect(img.y).toBeGreaterThanOrEqual(grid.ys[1] - 1e-6);
      expect(img.y + img.h).toBeLessThanOrEqual(grid.ys[grid.ys.length - 2] + 1e-6);
      expect(img.x).toBeGreaterThanOrEqual(grid.xs[0] - 1e-6);
      expect(img.x + img.w).toBeLessThanOrEqual(grid.xs[grid.xs.length - 1] + 1e-6);
    });
  });

  it.each(Object.entries(ASPECTS))('keeps the other images out of the picture window during a hold, in %s', (_, size) => {
    const [, height] = size;
    const grid = model.storyGrid(PARAMS, size[0], height);
    const { holds } = model.storyPhases(PARAMS, LENGTH);

    holds.forEach((hold, i) => {
      frame(middle(hold), PARAMS, size).images.forEach((img, k) => {
        if (k === i) {
          return;
        }
        expect(img.y + img.h <= grid.ys[1] || img.y >= grid.ys[grid.ys.length - 2]).toBe(true);
      });
    });
  });

  it.each(Object.entries(ASPECTS))('never jumps between frames in %s', (_, size) => {
    const height = size[1];
    const frames = times().map((t) => frame(t, PARAMS, size));
    const slots = (f: Frame) => f.heads.flatMap((h) => [h.kicker, h.index, ...h.lines]);


    frames.slice(1).forEach((f, i) => {
      const prev = frames[i];
      slots(f).forEach((s, k) => {
        expect(Math.abs(s.y - slots(prev)[k].y)).toBeLessThan(0.35);
        expect(Math.abs(s.opacity - slots(prev)[k].opacity)).toBeLessThan(0.35);
      });
      f.images.forEach((img, k) => expect(Math.abs(img.y - prev.images[k].y)).toBeLessThan(height * 0.12));
      f.marks.forEach((m, k) => expect(Math.abs(m - prev.marks[k])).toBeLessThan(0.2));
    });
  });

  it('drifts a hold only when idle drift is on, and only a little', () => {
    const p = { ...PARAMS, idleDrift: 1 };
    const [hold] = model.storyPhases(p, LENGTH).holds;
    const [a, b] = [frame(hold[0] + 0.05, p), frame(hold[1] - 0.05, p)];

    expect(b.images[0].y).not.toBe(a.images[0].y);
    expect(Math.abs(b.images[0].y - a.images[0].y)).toBeLessThan(1080 * 0.03);
  });

  it.each(['expo', 'quint', 'cubic'])('lands every move with %s easing', (easing) => {
    const p = { ...PARAMS, easing };
    const { holds } = model.storyPhases(p, LENGTH);

    expect(frame(middle(holds[1]), p).position).toBe(1);
    expect(frame(middle(holds[2]), p).position).toBe(2);
  });

  it('fades instead of masking when the swap style is fade', () => {
    const p = { ...PARAMS, swapStyle: 'fade' };
    const [swap] = model.swapPlan(p, LENGTH);
    const f = frame(swap.outAt[2] + PARAMS.swapDuration / 2, p);

    expect(f.heads[0].lines[0].opacity).toBeGreaterThan(0);
    expect(f.heads[0].lines[0].opacity).toBeLessThan(1);
    expect(Math.abs(f.heads[0].lines[0].y)).toBeLessThan(0.2);
  });
});
