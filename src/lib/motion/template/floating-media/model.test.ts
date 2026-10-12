import { describe, expect, it } from 'vitest';
import { FLOAT_MODEL } from './model';

type Card = { x: number; y: number; z: number; w: number; h: number; opacity: number; blur: number; rx: number; ry: number };
type Frame = { cards: Card[]; words: { y: number; blur: number; opacity: number }[]; subtitle: number; camera: number };
type Model = {
  floatLayout: (p: object, width: number, height: number) => object[];
  floatFrame: (layout: object[], p: object, t: number, length: number) => Frame;
  scaleAt: (z: number) => number;
  safeBox: (p: object, box: { ax: number; ay: number }) => { hw: number; hh: number };
  frameBox: (width: number, height: number) => { ax: number; ay: number };
};

const model = new Function(`${FLOAT_MODEL}; return { floatLayout, floatFrame, scaleAt, safeBox, frameBox };`)() as Model;

const PARAMS = { title: 'made to move', count: 5, layout: 'orbit', depth: 2, drift: 0.035, speed: 1, resistance: 0.8, cardSize: 0.26, safeWidth: 0.5, safeHeight: 0.34, tilt: 1, focusBlur: 6, dim: 0.35, entrance: true, leave: true, enterAt: 0, stagger: 0.12, titleAt: 0, titleBlur: 0.25, push: 0.25 };
const LENGTH = 10;
const FPS = 30;
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;
const LAYOUTS = ['orbit', 'cloud', 'grid-depth'];

const times = (length = LENGTH) => Array.from({ length: Math.round(length * FPS) + 1 }, (_, i) => i / FPS);

const screen = (c: Card) => {
  const s = model.scaleAt(c.z);
  return { x: c.x * s, y: c.y * s, hw: (c.w / 2) * s, hh: (c.h / 2) * s };
};

describe('the floating media model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const layout = model.floatLayout(PARAMS, 1920, 1080);
    const at = [0.4, 3, 7.2, 9.6];
    const forward = at.map((t) => model.floatFrame(layout, PARAMS, t, LENGTH));
    const backward = [...at].reverse().map((t) => model.floatFrame(layout, PARAMS, t, LENGTH)).reverse();

    expect(backward).toEqual(forward);
    expect(model.floatLayout(PARAMS, 1920, 1080)).toEqual(layout);
  });

  it('closes the loop: the last frame matches the first', () => {
    for (const params of [PARAMS, { ...PARAMS, entrance: false }]) {
      const layout = model.floatLayout(params, 1920, 1080);
      const first = model.floatFrame(layout, params, 0, LENGTH);
      const last = model.floatFrame(layout, params, LENGTH, LENGTH);

      first.cards.forEach((c, i) => {
        expect(last.cards[i].opacity).toBeCloseTo(c.opacity, 3);
        expect(last.cards[i].x).toBeCloseTo(c.x, 6);
        expect(last.cards[i].y).toBeCloseTo(c.y, 6);
      });
      expect(last.camera).toBeCloseTo(first.camera, 6);
    }
  });

  it('drifts for the whole video without ever stopping or jumping', () => {
    const layout = model.floatLayout({ ...PARAMS, entrance: false }, 1920, 1080);
    const path = times().map((t) => model.floatFrame(layout, { ...PARAMS, entrance: false }, t, LENGTH).cards[0]);
    const steps = path.slice(1).map((c, i) => Math.hypot(c.x - path[i].x, c.y - path[i].y));
    const typical = steps.reduce((a, b) => a + b, 0) / steps.length;

    expect(Math.max(...steps)).toBeLessThan(typical * 4);
    expect(typical).toBeGreaterThan(0);
  });

  it('more resistance means a smaller, slower drift', () => {
    const reach = (resistance: number) => {
      const p = { ...PARAMS, entrance: false, speed: 3, resistance };
      const layout = model.floatLayout(p, 1920, 1080);
      const xs = times().map((t) => model.floatFrame(layout, p, t, LENGTH).cards[0].x);
      return Math.max(...xs) - Math.min(...xs);
    };

    expect(reach(2)).toBeLessThan(reach(0.3));
  });

  for (const layout of LAYOUTS) {
    for (const [name, [width, height]] of Object.entries(ASPECTS)) {
      it(`keeps every ${layout} card out of the title in ${name}`, () => {
        const p = { ...PARAMS, layout, count: 12 };
        const safe = model.safeBox(p, model.frameBox(width, height));
        const placed = model.floatLayout(p, width, height);

        for (const t of times().filter((_, i) => i % 5 === 0)) {
          for (const c of model.floatFrame(placed, p, t, LENGTH).cards.filter((c) => c.opacity > 0.05)) {
            const s = screen(c);
            const inside = Math.abs(s.x) < s.hw + safe.hw && Math.abs(s.y) < s.hh + safe.hh;
            expect(inside, `${layout} ${name} t=${t}`).toBe(false);
          }
        }
      });
    }
  }

  it('reveals the title word by word with a settle, never a bounce', () => {
    const layout = model.floatLayout(PARAMS, 1920, 1080);
    const words = times().map((t) => model.floatFrame(layout, PARAMS, t, LENGTH).words);
    const firstIn = words.findIndex((w) => w[0].opacity > 0.5);
    const lastIn = words.findIndex((w) => w[2].opacity > 0.5);

    expect(firstIn).toBeLessThan(lastIn);
    expect(Math.min(...words.slice(0, LENGTH * FPS / 2).map((w) => w[0].y))).toBeGreaterThan(-0.42 * 0.03);
  });

  it('starts the cards only once the title has landed', () => {
    const layout = model.floatLayout(PARAMS, 1920, 1080);
    const frames = times().map((t) => model.floatFrame(layout, PARAMS, t, LENGTH));
    const titleDone = frames.findIndex((f) => f.words.every((w) => w.opacity >= 0.999));
    const firstCard = frames.findIndex((f) => f.cards.some((c) => c.opacity > 0.001));

    expect(titleDone).toBeGreaterThan(0);
    expect(firstCard).toBeGreaterThanOrEqual(titleDone);
  });

  it('shows the title within the first frames, not a blank screen', () => {
    const layout = model.floatLayout(PARAMS, 1920, 1080);

    expect(model.floatFrame(layout, PARAMS, 0.2, LENGTH).words[0].opacity).toBeGreaterThan(0.3);
  });

  for (const [name, [width, height]] of Object.entries(ASPECTS)) {
    it(`never overlaps two of the five orbit cards in ${name}`, () => {
      const p = { ...PARAMS, entrance: false };
      const placed = model.floatLayout(p, width, height);

      for (const t of times().filter((_, i) => i % 10 === 0)) {
        const boxes = model.floatFrame(placed, p, t, LENGTH).cards.map(screen);
        boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
          expect(Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh, `${name} t=${t}`).toBe(false);
        }));
      }
    });
  }

  it('puts some cards clearly far back, where they blur', () => {
    const p = { ...PARAMS, entrance: false };
    const cards = model.floatFrame(model.floatLayout(p, 1920, 1080), p, 5, LENGTH).cards;

    expect(Math.min(...cards.map((c) => c.z))).toBeLessThan(-1.2);
    expect(Math.max(...cards.map((c) => c.blur))).toBeGreaterThan(3);
  });
});
