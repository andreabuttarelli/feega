import { describe, expect, it } from 'vitest';
import { STRIP_MODEL } from './model';

type Gesture = { at: number; end: number; from: number; to: number };
type Plan = { gestures: Gesture[]; length: number; count: number };
type Card = { slot: number; photo: number; x: number; y: number; w: number; h: number; scale: number; lift: number; z: number };
type Frame = { cards: Card[]; caption: { photo: number; opacity: number; x: number; y: number }; cursor: { x: number; opacity: number } };
type Model = {
  stripPlan: (p: object, length: number) => Plan;
  stripPos: (plan: Plan, t: number) => number;
  magnifyAt: (d: number, p: object) => number;
  stripFrame: (p: object, t: number, length: number, width: number, height: number, pos?: number) => Frame;
  releaseTarget: (pos: number, velocity: number) => number;
  restAfter: (plan: Plan, t: number) => { at: number; pos: number };
};

const model = new Function(`${STRIP_MODEL}; return { stripPlan, stripPos, magnifyAt, stripFrame, releaseTarget, restAfter };`)() as Model;

const PARAMS = { count: 10, cardSize: 0.24, aspect: 0.8, gap: 0.035, magnify: 1.75, falloff: 1.2, step: 1.5, gesture: 1.2, pause: 0.45, direction: 'left', lift: 0.04, cursor: false };
const LENGTH = 12;
const FPS = 30;
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;

const times = (length = LENGTH) => Array.from({ length: Math.round(length * FPS) + 1 }, (_, i) => i / FPS);
const centred = (f: Frame) => f.cards.reduce((a, b) => (Math.abs(b.x) < Math.abs(a.x) ? b : a));

describe('the photo strip model', () => {
  it('magnifies the centred card most and fades smoothly to 1 with distance', () => {
    const at = (d: number) => model.magnifyAt(d, PARAMS);

    expect(at(0)).toBeCloseTo(1.75, 6);
    expect(at(0.3)).toBeLessThan(at(0));
    expect(at(0.6)).toBeLessThan(at(0.3));
    expect(at(1.2)).toBeCloseTo(1, 6);
    expect(at(3)).toBe(1);
    expect(at(-0.4)).toBeCloseTo(at(0.4), 9);
    const slope = (d: number) => (at(d + 1e-4) - at(d - 1e-4)) / 2e-4;
    expect(Math.abs(slope(0))).toBeLessThan(1e-3);
    expect(Math.abs(slope(1.2))).toBeLessThan(1e-3);
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.4, 3, 7.2, 11.6];
    const forward = at.map((t) => model.stripFrame(PARAMS, t, LENGTH, 1920, 1080));
    const backward = [...at].reverse().map((t) => model.stripFrame(PARAMS, t, LENGTH, 1920, 1080)).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: the strip wraps so the last frame matches the first', () => {
    for (const p of [PARAMS, { ...PARAMS, count: 8, step: 3 }, { ...PARAMS, count: 12, step: 1, direction: 'right' }]) {
      const first = model.stripFrame(p, 0, LENGTH, 1920, 1080);
      const last = model.stripFrame(p, LENGTH, LENGTH, 1920, 1080);
      const visible = (f: Frame) => f.cards.filter((c) => Math.abs(c.x) < 1.2).sort((a, b) => a.x - b.x).map((c) => [c.photo, c.x, c.scale]);

      expect(visible(last)).toHaveLength(visible(first).length);
      visible(first).forEach((c, i) => {
        expect(visible(last)[i][0]).toBe(c[0]);
        expect(visible(last)[i][1]).toBeCloseTo(c[1] as number, 6);
      });
    }
  });

  it('rests on a centred card for short pauses only', () => {
    const plan = model.stripPlan(PARAMS, LENGTH);
    const rests = plan.gestures.map((g, i) => (plan.gestures[i + 1]?.at ?? plan.gestures[0].at + LENGTH) - g.end);

    for (const rest of rests) {
      expect(rest).toBeGreaterThanOrEqual(0.3);
      expect(rest).toBeLessThanOrEqual(0.6);
    }
    for (const g of plan.gestures) {
      expect(Number.isInteger(g.to)).toBe(true);
      expect(model.stripPos(plan, (g.end + (plan.gestures.find((n) => n.at > g.end)?.at ?? g.end + 0.3)) / 2)).toBeCloseTo(g.to, 9);
    }
  });

  it('never stands still longer than a short pause', () => {
    const plan = model.stripPlan(PARAMS, LENGTH);
    const pos = times().map((t) => model.stripPos(plan, t));
    let still = 0;
    let longest = 0;
    pos.slice(1).forEach((s, i) => {
      still = Math.abs(s - pos[i]) < 0.002 ? still + 1 : 0;
      longest = Math.max(longest, still);
    });

    expect(longest / FPS).toBeLessThanOrEqual(0.8);
  });

  it('moves like a hand flick: no jumps, no sudden change of speed', () => {
    const plan = model.stripPlan(PARAMS, LENGTH);
    const pos = times().map((t) => model.stripPos(plan, t));
    const speed = pos.slice(1).map((s, i) => s - pos[i]);
    const kick = speed.slice(1).map((v, i) => Math.abs(v - speed[i]));
    const g = plan.gestures[0];
    const at = (x: number) => (model.stripPos(plan, g.at + x * (g.end - g.at)) - g.from) / (g.to - g.from);

    expect(Math.max(...speed.map(Math.abs))).toBeLessThan(0.35);
    expect(Math.max(...kick)).toBeLessThan(0.04);
    expect(at(0.4)).toBeGreaterThan(0.5);
  });

  it('settles softly past the target, never a bounce', () => {
    const plan = model.stripPlan(PARAMS, LENGTH);
    const g = plan.gestures[0];
    const xs = times().filter((t) => t >= g.at && t <= g.end).map((t) => (model.stripPos(plan, t) - g.from) / (g.to - g.from));

    expect(Math.max(...xs)).toBeGreaterThan(1);
    expect(Math.max(...xs)).toBeLessThan(1.03);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1e-9);
  });

  it('wraps cards only out of sight in every aspect', () => {
    for (const [name, [width, height]] of Object.entries(ASPECTS)) {
      for (const count of [8, 4, 12]) {
        const p = { ...PARAMS, count };
        const half = width / Math.min(width, height) / 2;
        const frames = times().filter((_, i) => i % 3 === 0).map((t) => model.stripFrame(p, t, LENGTH, width, height));
        frames.slice(1).forEach((f, i) => {
          for (const c of f.cards) {
            const before = frames[i].cards.find((b) => b.slot === c.slot)!;
            if (Math.abs(c.x - before.x) > 0.5) {
              expect(Math.min(Math.abs(c.x), Math.abs(before.x)) - c.w * c.scale, `${name} ${count}`).toBeGreaterThan(half);
            }
          }
        });
      }
    }
  });

  it('keeps the magnified card in frame and clear of its neighbours', () => {
    for (const [name, [width, height]] of Object.entries(ASPECTS)) {
      const ay = height / Math.min(width, height) / 2;
      for (const t of times().filter((_, i) => i % 4 === 0)) {
        const cards = model.stripFrame(PARAMS, t, LENGTH, width, height).cards.sort((a, b) => a.x - b.x);
        for (const c of cards) {
          expect(Math.abs(c.y) + (c.h * c.scale) / 2, `${name} t=${t}`).toBeLessThanOrEqual(ay);
        }
        cards.slice(1).forEach((c, i) => {
          expect(c.x - cards[i].x, `${name} t=${t}`).toBeGreaterThan((c.w * c.scale + cards[i].w * cards[i].scale) / 2);
        });
      }
    }
  });

  it('labels the centred photo only while it rests in the middle', () => {
    const plan = model.stripPlan(PARAMS, LENGTH);
    const g = plan.gestures[1];
    const resting = model.stripFrame(PARAMS, g.at - 0.1, LENGTH, 1920, 1080);
    const moving = model.stripFrame(PARAMS, (g.at + g.end) / 2, LENGTH, 1920, 1080);

    expect(resting.caption.opacity).toBeGreaterThan(0.95);
    expect(resting.caption.photo).toBe(centred(resting).photo);
    expect(moving.caption.opacity).toBeLessThan(0.05);
  });

  it('moves the other way when asked', () => {
    const left = model.stripPlan(PARAMS, LENGTH).gestures[0];
    const right = model.stripPlan({ ...PARAMS, direction: 'right' }, LENGTH).gestures[0];

    expect(Math.sign(left.to - left.from)).toBe(-Math.sign(right.to - right.from));
  });

  it('hides the cursor unless asked, and shows it only while dragging', () => {
    const plan = model.stripPlan(PARAMS, LENGTH);
    const g = plan.gestures[1];

    expect(model.stripFrame(PARAMS, (g.at + g.end) / 2, LENGTH, 1920, 1080).cursor.opacity).toBe(0);
    expect(model.stripFrame({ ...PARAMS, cursor: true }, (g.at + g.end) / 2, LENGTH, 1920, 1080).cursor.opacity).toBeGreaterThan(0.5);
  });

  it('a real drag snaps to a whole card, flung further when faster', () => {
    expect(model.releaseTarget(3.4, 0)).toBe(3);
    expect(model.releaseTarget(3.4, 6)).toBeGreaterThan(3);
    expect(Number.isInteger(model.releaseTarget(-1.7, -3))).toBe(true);
  });

  it('a released drag hands back to the next rest, where the strip stands still', () => {
    const plan = model.stripPlan(PARAMS, LENGTH);
    const rest = model.restAfter(plan, 2);

    expect(rest.at).toBeGreaterThanOrEqual(2);
    expect(model.stripPos(plan, rest.at)).toBeCloseTo(rest.pos, 9);
    expect(model.stripPos(plan, rest.at + 0.05)).toBeCloseTo(rest.pos, 9);
  });
});
