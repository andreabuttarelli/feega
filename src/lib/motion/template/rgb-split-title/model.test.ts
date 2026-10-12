import { describe, expect, it } from 'vitest';
import { RGB_MODEL } from './model';

type Word = { opacity: number; rise: number };
type Frame = { amount: number; offsets: number[]; blur: number; drift: number; zoom: number; words: Word[] };
type Model = { rgbFrame: (p: object, t: number, length: number, words: number) => Frame; titleWords: (raw: string) => string[] };

const model = new Function(`${RGB_MODEL}; return { rgbFrame, titleWords };`)() as Model;

const PARAMS = { split: 0.035, blur: 0.02, settle: 3.2, titleAt: 0.6 };
const LENGTH = 8;
const FPS = 30;
const WORDS = 5;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const frame = (t: number) => model.rgbFrame(PARAMS, t, LENGTH, WORDS);

describe('the rgb split title model', () => {
  it('splits a title into words', () => {
    expect(model.titleWords('  The most  precise edit model ')).toEqual(['The', 'most', 'precise', 'edit', 'model']);
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.2, 2.5, 6.1, 7.9];
    const forward = at.map(frame);
    const backward = [...at].reverse().map(frame).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: first and last frame are the same split, untitled picture', () => {
    expect(frame(LENGTH)).toEqual(frame(0));
    expect(frame(0).amount).toBe(1);
    expect(frame(0).words.every((w) => w.opacity === 0)).toBe(true);
  });

  it('settles into focus: the channels meet and the blur is gone mid-loop', () => {
    const sharp = frame(LENGTH / 2 + 1);

    expect(sharp.amount).toBe(0);
    expect(sharp.blur).toBe(0);
    expect(sharp.offsets).toEqual([0, 0, 0]);
  });

  it('pulls red and blue apart in opposite directions, green holds', () => {
    const [red, green, blue] = frame(0).offsets;

    expect(red).toBeLessThan(0);
    expect(blue).toBeGreaterThan(0);
    expect(green).toBe(0);
  });

  it('reveals the title while the picture is still split', () => {
    const t = times().find((at) => frame(at).words[WORDS - 1].opacity > 0.99) ?? LENGTH;

    expect(frame(t).amount).toBeGreaterThan(0.05);
  });

  it('staggers the words left to right', () => {
    const firstSeen = Array.from({ length: WORDS }, (_, i) => times().findIndex((t) => frame(t).words[i].opacity > 0.01));

    expect([...firstSeen].sort((a, b) => a - b)).toEqual(firstSeen);
    expect(new Set(firstSeen).size).toBe(WORDS);
  });

  it('never holds still: the picture keeps breathing while it is sharp', () => {
    const all = times().map(frame);
    for (let f = 1; f < all.length - 1; f++) {
      expect(all[f].zoom).not.toBe(all[f - 1].zoom);
    }
  });

  it('moves without jumps between frames', () => {
    const all = times().map(frame);
    for (let f = 1; f < all.length; f++) {
      expect(Math.abs(all[f].amount - all[f - 1].amount)).toBeLessThan(0.12);
      all[f].words.forEach((w, i) => expect(Math.abs(w.opacity - all[f - 1].words[i].opacity)).toBeLessThan(0.2));
    }
  });
});
