import { describe, expect, it } from 'vitest';
import { BRACKET_MODEL } from './model';

type Blob = { x: number; y: number; r: number };
type Frame = { open: number; half: { x: number; y: number }; marks: number; words: { rise: number; opacity: number }[]; blobs: Blob[] };
type Box = { w: number; h: number };
type Model = { bracketFrame: (p: object, box: Box, t: number, length: number, words: number) => Frame };

const model = new Function(`${BRACKET_MODEL}; return { bracketFrame };`)() as Model;

const PARAMS = { titleAt: 0.3, openSeconds: 1.3, closeSeconds: 1, padX: 0.55, padY: 0.8, drift: 0.12, leave: true };
const BOX: Box = { w: 14, h: 1.2 };
const LENGTH = 8;
const FPS = 30;
const WORDS = 7;

const run = (p: object = PARAMS) => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => model.bracketFrame(p, BOX, i / FPS, LENGTH, WORDS));
const full = { x: BOX.w / 2 + PARAMS.padX, y: BOX.h / 2 + PARAMS.padY };

describe('the bracket gradient model', () => {
  it('opens the brackets from the centre to frame the text', () => {
    const frames = run();
    const opened = frames.find((f) => f.open === 1);

    expect(frames[0].half).toEqual({ x: 0, y: 0 });
    expect(opened?.half.x).toBeCloseTo(full.x, 9);
    expect(opened?.half.y).toBeCloseTo(full.y, 9);
  });

  it('never opens past the frame around the text: no overshoot', () => {
    run().forEach((f) => {
      expect(f.open).toBeGreaterThanOrEqual(0);
      expect(f.open).toBeLessThanOrEqual(1);
      expect(f.half.x).toBeLessThanOrEqual(full.x + 1e-9);
    });
  });

  it('starts the words while the brackets are still opening', () => {
    const frames = run();
    const firstWord = frames.findIndex((f) => f.words[0].opacity > 0);

    expect(frames[firstWord].open).toBeLessThan(1);
  });

  it('has no speed jumps in the brackets', () => {
    const frames = run();
    const steps = frames.slice(1).map((f, i) => f.half.x - frames[i].half.x);
    const jumps = steps.slice(1).map((s, i) => Math.abs(s - steps[i]));

    expect(Math.max(...jumps)).toBeLessThan(Math.max(...steps.map(Math.abs)) * 0.5);
  });

  it('loops: the first and last frames are the same empty gradient', () => {
    const frames = run();
    const [first, last] = [frames[0], frames[frames.length - 1]];

    expect(first.marks).toBe(0);
    expect(last.marks).toBeCloseTo(0, 9);
    last.words.forEach((w) => expect(w.opacity).toBeCloseTo(0, 9));
    last.blobs.forEach((b, i) => {
      expect(b.x).toBeCloseTo(first.blobs[i].x, 9);
      expect(b.y).toBeCloseTo(first.blobs[i].y, 9);
      expect(b.r).toBeCloseTo(first.blobs[i].r, 9);
    });
  });

  it('keeps the gradient moving on every frame, gently', () => {
    const frames = run();
    const moves = frames.slice(1).map((f, i) => Math.hypot(f.blobs[0].x - frames[i].blobs[0].x, f.blobs[0].y - frames[i].blobs[0].y));

    expect(Math.min(...moves)).toBeGreaterThan(0);
    expect(Math.max(...moves)).toBeLessThan(0.01);
  });

  it('without loop, stays framed on the last frame', () => {
    const last = run({ ...PARAMS, leave: false }).at(-1);

    expect(last?.open).toBe(1);
    last?.words.forEach((w) => expect(w.opacity).toBe(1));
  });

  it('is a pure function of t', () => {
    const at = [0.4, 2.1, 6.9];
    const forward = at.map((t) => model.bracketFrame(PARAMS, BOX, t, LENGTH, WORDS));
    const backward = [...at].reverse().map((t) => model.bracketFrame(PARAMS, BOX, t, LENGTH, WORDS)).reverse();

    expect(backward).toEqual(forward);
  });
});
