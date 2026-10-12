import { describe, expect, it } from 'vitest';
import { WORD_ENTRANCE } from './word-entrance';

type Word = { progress: number; rise: number; opacity: number };
const { wordIn, WORD_IN } = new Function(`${WORD_ENTRANCE}; return { wordIn, WORD_IN };`)() as { wordIn: (t: number, at: number) => Word; WORD_IN: number };

const FPS = 60;
const FRAME = 1 / FPS;
const AT = 0.5;
const END = AT + WORD_IN;

describe('a word entrance lands without a final step', () => {
  it('arrives at rest continuously: the frame before rest is already there', () => {
    const before = wordIn(END - 1e-6, AT).rise;
    expect(before).toBeLessThan(1e-6);
  });

  it('slows to zero speed, each last frame moving less than the one before', () => {
    const rises = Array.from({ length: 12 }, (_, i) => wordIn(END - (11 - i) * FRAME, AT).rise);
    const steps = rises.slice(1).map((r, i) => rises[i] - r);
    steps.slice(1).forEach((s, i) => expect(s).toBeLessThanOrEqual(steps[i]));
    expect(steps.at(-1)).toBeLessThan(1e-6);
  });

  it('moves while it fades in, never fading in first and hopping up after', () => {
    const fadedIn = Array.from({ length: 200 }, (_, i) => AT + (i * WORD_IN) / 200).find((t) => wordIn(t, AT).opacity >= 0.99) ?? END;
    expect(wordIn(fadedIn, AT).progress).toBeGreaterThan(0.5);
  });
});
