import { describe, expect, it } from 'vitest';
import { RING_MODEL } from './model';

type Card = { r: number; x: number; y: number; z: number; w: number; h: number; opacity: number; shade: number; layer: number; front: boolean };
type Word = { y: number; opacity: number };
type Frame = { cards: Card[]; words: Word[]; phase: number; titleLayer: number };
type Model = {
  ringLayout: (p: object) => object[];
  ringFrame: (layout: object[], p: object, t: number, length: number) => Frame;
};

const model = new Function(`${RING_MODEL}; return { ringLayout, ringFrame };`)() as Model;

const PARAMS = { title: '11 winners', cards: 16, cardSize: 0.115, cardAspect: 1.45, variety: 0.35, radius: 0.37, yaw: 38, tilt: 6, backDim: 0.2, turns: 1, titleAt: 0.2, ringAt: 0.9, ringSeconds: 1.6, stagger: 1.1, leave: true };
const LENGTH = 12;
const FPS = 30;
const TITLE_HALF = 0.16;
const times = (until = LENGTH) => Array.from({ length: Math.round(until * FPS) + 1 }, (_, i) => i / FPS);
const frame = (t: number, p: object = PARAMS) => model.ringFrame(model.ringLayout(p), p, t, LENGTH);

describe('the ring through title model', () => {
  it('puts one side of the ring in front of the title and the other behind it', () => {
    const f = frame(6);
    const front = f.cards.filter((c) => c.front);

    expect(f.cards).toHaveLength(16);
    expect(front.length).toBeGreaterThan(5);
    expect(front.length).toBeLessThan(11);
    f.cards.forEach((c) => expect(c.front).toBe(c.z > 0));
    f.cards.forEach((c) => expect(c.layer > f.titleLayer).toBe(c.front));
  });

  it('stacks the cards by depth: nearer always above farther', () => {
    const sorted = [...frame(6).cards].sort((a, b) => a.z - b.z);

    sorted.slice(1).forEach((c, i) => expect(c.layer).toBeGreaterThan(sorted[i].layer));
  });

  it('draws nearer cards bigger, and the side in front on the left', () => {
    const sorted = [...frame(6).cards].sort((a, b) => a.z - b.z);
    const near = sorted[sorted.length - 1];
    const far = sorted[0];

    expect(near.x).toBeLessThan(0);
    expect(far.x).toBeGreaterThan(0);
    expect(near.h / far.h).toBeGreaterThan(1.3);
  });

  it('crosses from behind to in front only above or below the title, never through its letters', () => {
    times().map((t) => frame(t)).forEach((f, k, all) => {
      if (k === 0) {
        return;
      }
      f.cards.forEach((c, i) => {
        if (c.front === all[k - 1].cards[i].front || c.opacity < 0.01) {
          return;
        }
        expect(Math.abs(c.y) - c.h / 2).toBeGreaterThan(TITLE_HALF);
      });
    });
  });

  it('enters the title first, then the ring', () => {
    const firstWord = times().find((t) => frame(t).words[0].opacity > 0.01)!;
    const firstCard = times().find((t) => frame(t).cards.some((c) => c.opacity > 0.01))!;

    expect(frame(0).cards.every((c) => c.opacity === 0)).toBe(true);
    expect(firstCard).toBeGreaterThan(firstWord + 0.5);
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.3, 2, 6.4, 11.8];
    const forward = at.map((t) => frame(t));
    const backward = [...at].reverse().map((t) => frame(t)).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: the last frame matches the first', () => {
    const first = frame(0);
    const last = frame(LENGTH);

    first.cards.forEach((c, i) => expect(last.cards[i].opacity).toBeCloseTo(c.opacity, 4));
    first.words.forEach((w, i) => expect(last.words[i].opacity).toBeCloseTo(w.opacity, 4));
  });

  it('turns forward the whole time, never stopping, jerking or turning back', () => {
    const phases = times().map((t) => frame(t).phase);
    const steps = phases.slice(1).map((y, i) => y - phases[i]);
    const base = (2 * Math.PI) / (LENGTH * FPS);

    steps.forEach((s) => expect(s).toBeGreaterThan(base * 0.5));
    steps.slice(1).forEach((s, i) => expect(Math.abs(s - steps[i])).toBeLessThan(base * 0.25));
  });

  it('turns a whole number of times per loop', () => {
    const turned = (frame(LENGTH).phase - frame(0).phase) / (2 * Math.PI);

    expect(turned).toBeCloseTo(Math.round(turned), 6);
  });

  it('enters monotonically: cards close in and fade up, words only rise', () => {
    const path = times(5).map((t) => frame(t));
    path.slice(1).forEach((f, k) => {
      f.cards.forEach((c, i) => {
        expect(c.r).toBeLessThanOrEqual(path[k].cards[i].r + 1e-9);
        expect(c.opacity).toBeGreaterThanOrEqual(path[k].cards[i].opacity - 1e-9);
      });
      f.words.forEach((w, i) => expect(w.y).toBeLessThanOrEqual(path[k].words[i].y + 1e-9));
    });
  });
});
