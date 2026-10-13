import { describe, expect, it } from 'vitest';
import { STACK_MODEL } from './model';

type Card = { index: number; media: number; x: number; y: number; w: number; h: number; opacity: number; zoom: number };
type Word = { text: string; x: number; y: number; size: number; opacity: number; rise: number };
type Frame = { cards: Card[]; words: Word[] };
type Model = { stackFrame: (p: object, t: number, length: number, width: number, height: number) => Frame };

const model = new Function(`${STACK_MODEL}; return { stackFrame };`)() as Model;

const PARAMS = { words: 'gets / better', cards: 5, fontSize: 0.08, cardHeight: 0.56, cardAspect: 0.8, overlap: 0.42, beat: 0.75, lead: 0.3 };
const LENGTH = 10;
const FPS = 30;
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;
const CHAR_EM = 0.56;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const frame = (t: number, [w, h]: readonly [number, number] = ASPECTS.landscape) => model.stackFrame(PARAMS, t, LENGTH, w, h);
const onScreen = (c: Card, w: number) => c.opacity > 0.01 && c.x + c.w > 0 && c.x < w;
const held = LENGTH * 0.7;

describe('the stack words model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.3, 2.2, 5, 9.4];
    const forward = at.map((t) => frame(t));
    const backward = [...at].reverse().map((t) => frame(t)).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: the first and the last frame are the same empty table', () => {
    for (const size of Object.values(ASPECTS)) {
      expect(frame(0, size).cards.some((c) => onScreen(c, size[0]))).toBe(false);
      expect(frame(0, size).words.every((w) => w.opacity === 0)).toBe(true);
      expect(frame(LENGTH, size).cards.some((c) => onScreen(c, size[0]))).toBe(false);
      expect(frame(LENGTH, size).words.every((w) => w.opacity < 1e-6)).toBe(true);
    }
  });

  it('deals the cards one after another from the left, the newest on the right', () => {
    const arrivals = frame(held).cards.map((c) => c.index);
    expect(arrivals).toEqual([0, 1, 2, 3, 4]);
    const lefts = frame(held).cards.map((c) => c.x);
    lefts.slice(1).forEach((x, i) => expect(x).toBeGreaterThan(lefts[i]));
    const firstSeen = frame(held).cards.map((_, i) => times().findIndex((t) => onScreen(frame(t).cards[i], 1920)));
    firstSeen.slice(1).forEach((f, i) => expect(f).toBeGreaterThan(firstSeen[i]));
  });

  it('makes the newest card the largest and overlaps its neighbours', () => {
    const cards = frame(held).cards;
    const hero = cards[cards.length - 1];
    cards.slice(0, -1).forEach((c) => expect(c.h).toBeLessThan(hero.h));
    cards.slice(1).forEach((c, i) => expect(c.x).toBeLessThan(cards[i].x + cards[i].w));
  });

  it('puts the first word above the hero and the second below, once the hero lands', () => {
    const f = frame(held);
    const hero = f.cards[f.cards.length - 1];
    const [above, below] = f.words;

    expect([above.text, below.text]).toEqual(['gets', 'better']);
    expect(above.y + above.size).toBeLessThanOrEqual(hero.y + 1);
    expect(below.y).toBeGreaterThanOrEqual(hero.y + hero.h - 1);
    expect(Math.abs(above.x - (hero.x + hero.w / 2))).toBeLessThan(2);
    expect(frame(1).words.every((w) => w.opacity === 0)).toBe(true);
  });

  it('moves without jumps: no card or word changes by more than a frame-sized step', () => {
    const all = times().map((t) => frame(t));
    for (let f = 1; f < all.length; f++) {
      all[f].cards.forEach((c, i) => {
        const was = all[f - 1].cards[i];
        expect(Math.abs(c.x - was.x)).toBeLessThan(1920 * 0.15);
        expect(Math.abs(c.h - was.h)).toBeLessThan(1080 * 0.02);
      });
      all[f].words.forEach((w, i) => expect(Math.abs(w.opacity - all[f - 1].words[i].opacity)).toBeLessThan(0.35));
    }
  });

  it.each(Object.entries(ASPECTS))('keeps the hero and its words inside the %s frame', (_, size) => {
    const [w, h] = size;
    const f = frame(held, size);
    const hero = f.cards[f.cards.length - 1];
    expect(hero.x).toBeGreaterThanOrEqual(0);
    expect(hero.x + hero.w).toBeLessThanOrEqual(w);
    for (const word of f.words) {
      const half = (word.text.length * CHAR_EM * word.size) / 2;
      expect(word.x - half).toBeGreaterThanOrEqual(0);
      expect(word.x + half).toBeLessThanOrEqual(w);
      expect(word.y).toBeGreaterThanOrEqual(0);
      expect(word.y + word.size * 1.1).toBeLessThanOrEqual(h);
    }
  });
});
