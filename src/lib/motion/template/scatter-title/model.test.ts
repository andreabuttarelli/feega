import { describe, expect, it } from 'vitest';
import { SCATTER_MODEL } from './model';

type Card = { x: number; y: number; w: number; h: number; scale: number; opacity: number };
type Placed = { x: number; y: number; w: number; h: number; rank: number };
type Frame = { cards: Card[]; words: { y: number; opacity: number }[] };
type Box = { hw: number; hh: number };
type Model = {
  scatterLayout: (p: object, width: number, height: number, title: Box) => Placed[];
  scatterFrame: (layout: Placed[], p: object, t: number, length: number, words: number) => Frame;
  frameBox: (width: number, height: number) => { ax: number; ay: number };
};

const model = new Function(`${SCATTER_MODEL}; return { scatterLayout, scatterFrame, frameBox };`)() as Model;

const PARAMS = { count: 12, cardScale: 1, spread: 0.14, depth: 0.6, cardsAt: 0.1, stagger: 0.08, titleAt: 0.3, leave: true };
const LENGTH = 10;
const FPS = 30;
const WORDS = 4;
const TITLE: Record<string, Box> = { landscape: { hw: 0.48, hh: 0.07 }, vertical: { hw: 0.43, hh: 0.13 }, square: { hw: 0.43, hh: 0.13 } };
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const shown = (c: Card) => ({ x: c.x, y: c.y, hw: (c.w / 2) * c.scale, hh: (c.h / 2) * c.scale });
const hit = (a: Box & { x: number; y: number }, b: Box & { x: number; y: number }) => Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh;

describe('the scatter title model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const layout = model.scatterLayout(PARAMS, 1920, 1080, TITLE.landscape);
    const at = [0.4, 3, 7.2, 9.6];
    const forward = at.map((t) => model.scatterFrame(layout, PARAMS, t, LENGTH, WORDS));
    const backward = [...at].reverse().map((t) => model.scatterFrame(layout, PARAMS, t, LENGTH, WORDS)).reverse();

    expect(backward).toEqual(forward);
    expect(model.scatterLayout(PARAMS, 1920, 1080, TITLE.landscape)).toEqual(layout);
  });

  it('closes the loop: first and last frames are the same empty frame', () => {
    const layout = model.scatterLayout(PARAMS, 1920, 1080, TITLE.landscape);
    const first = model.scatterFrame(layout, PARAMS, 0, LENGTH, WORDS);
    const last = model.scatterFrame(layout, PARAMS, LENGTH, LENGTH, WORDS);

    [...first.cards, ...last.cards, ...first.words, ...last.words].forEach((c) => expect(c.opacity).toBeCloseTo(0, 4));
  });

  it('ships twelve cards of varied sizes and shapes by default', () => {
    const layout = model.scatterLayout(PARAMS, 1920, 1080, TITLE.landscape);
    const widths = layout.map((c) => c.w);
    const shapes = new Set(layout.map((c) => Math.round((c.h / c.w) * 10)));

    expect(layout).toHaveLength(12);
    expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(2.5);
    expect(shapes.size).toBeGreaterThan(2);
  });

  it('lets some cards bleed off the frame, like an editorial collage', () => {
    const box = model.frameBox(1920, 1080);
    const layout = model.scatterLayout(PARAMS, 1920, 1080, TITLE.landscape);

    expect(layout.some((c) => Math.abs(c.x) + c.w / 2 > box.ax || Math.abs(c.y) + c.h / 2 > box.ay)).toBe(true);
  });

  it('drifts outward from the centre for the whole hold, never inward', () => {
    const layout = model.scatterLayout(PARAMS, 1920, 1080, TITLE.landscape);
    const hold = times().filter((t) => t > 3 && t < 8);
    for (const i of layout.keys()) {
      const reach = hold.map((t) => Math.hypot(model.scatterFrame(layout, PARAMS, t, LENGTH, WORDS).cards[i].x, model.scatterFrame(layout, PARAMS, t, LENGTH, WORDS).cards[i].y));
      reach.slice(1).forEach((r, k) => expect(r).toBeGreaterThan(reach[k]));
    }
  });

  it('moves without a jolt: speed never changes abruptly between frames', () => {
    const layout = model.scatterLayout(PARAMS, 1920, 1080, TITLE.landscape);
    for (const i of layout.keys()) {
      const path = times().map((t) => model.scatterFrame(layout, PARAMS, t, LENGTH, WORDS).cards[i]);
      const steps = path.slice(1).map((c, k) => Math.hypot(c.x - path[k].x, c.y - path[k].y));
      const jolts = steps.slice(1).map((s, k) => Math.abs(s - steps[k]));

      expect(Math.max(...jolts)).toBeLessThan(Math.max(...steps) * 0.5);
    }
  });

  it('staggers the cards in from the centre out', () => {
    const layout = model.scatterLayout(PARAMS, 1920, 1080, TITLE.landscape);
    const arrival = layout.map((_, i) => times().find((t) => model.scatterFrame(layout, PARAMS, t, LENGTH, WORDS).cards[i].opacity > 0.5)!);
    const reach = layout.map((c) => Math.hypot(c.x, c.y));
    const nearest = reach.indexOf(Math.min(...reach));
    const farthest = reach.indexOf(Math.max(...reach));

    expect(arrival[nearest]).toBeLessThan(arrival[farthest]);
  });

  it('fades every card in monotonically, never flickering', () => {
    const layout = model.scatterLayout(PARAMS, 1920, 1080, TITLE.landscape);
    const entrance = times().filter((t) => t < 4).map((t) => model.scatterFrame(layout, PARAMS, t, LENGTH, WORDS).cards);
    for (const i of layout.keys()) {
      entrance.slice(1).forEach((cards, k) => expect(cards[i].opacity).toBeGreaterThanOrEqual(entrance[k][i].opacity - 1e-9));
    }
  });

  it('brings the title in word by word, rising while it fades in', () => {
    const layout = model.scatterLayout(PARAMS, 1920, 1080, TITLE.landscape);
    const frames = times().map((t) => model.scatterFrame(layout, PARAMS, t, LENGTH, WORDS).words);
    const firstIn = frames.findIndex((w) => w[0].opacity > 0.5);
    const lastIn = frames.findIndex((w) => w[WORDS - 1].opacity > 0.5);

    expect(firstIn).toBeLessThan(lastIn);
    expect(frames[firstIn][0].y).toBeGreaterThan(0);
  });

  for (const [name, [width, height]] of Object.entries(ASPECTS)) {
    it(`never covers the title with a visible card in ${name}`, () => {
      const title = { x: 0, y: 0, ...TITLE[name] };
      const layout = model.scatterLayout(PARAMS, width, height, TITLE[name]);
      for (const t of times().filter((_, i) => i % 5 === 0)) {
        for (const c of model.scatterFrame(layout, PARAMS, t, LENGTH, WORDS).cards.filter((c) => c.opacity > 0.05)) {
          expect(hit(shown(c), title), `${name} t=${t}`).toBe(false);
        }
      }
    });

    it(`never lays two cards over each other in ${name}`, () => {
      const layout = model.scatterLayout(PARAMS, width, height, TITLE[name]);
      for (const t of [2, 5, 8]) {
        const boxes = model.scatterFrame(layout, PARAMS, t, LENGTH, WORDS).cards.map(shown);
        boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b, k) => expect(hit(a, b), `${name} t=${t} cards ${i} ${i + k + 1}`).toBe(false)));
      }
    });

    it(`keeps most of every card on screen in ${name}`, () => {
      const box = model.frameBox(width, height);
      for (const c of model.scatterLayout(PARAMS, width, height, TITLE[name])) {
        expect(Math.abs(c.x), name).toBeLessThan(box.ax);
        expect(Math.abs(c.y), name).toBeLessThan(box.ay);
      }
    });
  }
});
