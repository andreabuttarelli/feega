import { describe, expect, it } from 'vitest';
import { BADGE_MODEL } from './model';

type Word = { y: number; opacity: number };
type Frame = {
  arc: { lift: number; opacity: number };
  intro: Word[];
  badge: { scale: number; opacity: number; shine: number; shineOpacity: number };
  name: Word[];
};
type Model = { badgeFrame: (p: object, t: number, length: number, intro: number, name: number) => Frame };

const model = new Function(`${BADGE_MODEL}; return { badgeFrame };`)() as Model;

const PARAMS = { introAt: 0.3, badgeAt: 0.9, nameAt: 1.5, arcRise: 0.18, leave: true };
const LENGTH = 14;
const FEATURES = 5;
const FPS = 30;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const frame = (t: number) => model.badgeFrame(PARAMS, t, LENGTH, 1, FEATURES);
const firstShown = (pick: (f: Frame) => number) => times().find((t) => pick(frame(t)) > 0.5)!;

describe('the introducing badge model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.2, 1.7, 4, 7.6];
    const forward = at.map(frame);
    const backward = [...at].reverse().map(frame).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: first and last frames are the same empty frame', () => {
    for (const f of [frame(0), frame(LENGTH)]) {
      [...f.intro, ...f.name, f.badge, f.arc].forEach((x) => expect(x.opacity).toBeCloseTo(0, 4));
    }
    expect(frame(0).arc.lift).toBeCloseTo(frame(LENGTH).arc.lift, 4);
  });

  it('reads left to right: intro, then the badge, then the product name', () => {
    const intro = firstShown((f) => f.intro[0].opacity);
    const badge = firstShown((f) => f.badge.opacity);
    const name = firstShown((f) => f.name[0].opacity);

    expect(intro).toBeLessThan(badge);
    expect(badge).toBeLessThan(name);
  });

  it('pops the badge in without ever overshooting its size', () => {
    const scales = times().map((t) => frame(t).badge.scale);

    expect(Math.max(...scales)).toBeLessThanOrEqual(1 + 1e-9);
    expect(frame(3).badge.scale).toBeCloseTo(1, 4);
  });

  it('sweeps one shine across the badge only once it has landed', () => {
    const lit = times().filter((t) => frame(t).badge.shineOpacity > 0.01);

    expect(lit.length).toBeGreaterThan(0);
    lit.forEach((t) => expect(frame(t).badge.opacity).toBeGreaterThan(0.9));
    expect(frame(lit[lit.length - 1]).badge.shine).toBeGreaterThan(frame(lit[0]).badge.shine);
  });

  it('raises the arc for the whole hold, never sinking', () => {
    const hold = times().filter((t) => t > 0.2 && t < LENGTH - 2);
    const lifts = hold.map((t) => frame(t).arc.lift);

    lifts.slice(1).forEach((l, k) => expect(l).toBeGreaterThanOrEqual(lifts[k] - 1e-9));
    expect(lifts[lifts.length - 1]).toBeGreaterThan(lifts[0]);
  });

  it('moves the arc without a jolt: speed never changes abruptly between frames', () => {
    const lifts = times().map((t) => frame(t).arc.lift);
    const steps = lifts.slice(1).map((l, k) => l - lifts[k]);
    const jolts = steps.slice(1).map((s, k) => Math.abs(s - steps[k]));

    expect(Math.max(...jolts)).toBeLessThan(Math.max(...steps.map(Math.abs)) * 0.5);
  });

  it('brings words in rising while they fade, never flickering', () => {
    const entrance = times().filter((t) => t < 1.2).map((t) => frame(t).intro[0]);
    const firstIn = entrance.findIndex((w) => w.opacity > 0.2);

    expect(entrance[firstIn].y).toBeGreaterThan(0);
    entrance.slice(1).forEach((w, k) => expect(w.opacity).toBeGreaterThanOrEqual(entrance[k].opacity - 1e-9));
  });

  it('holds everything still when the loop exit is off', () => {
    const last = model.badgeFrame({ ...PARAMS, leave: false }, LENGTH, LENGTH, 1, FEATURES);

    expect(last.badge.opacity).toBeCloseTo(1, 4);
    expect(last.name[FEATURES - 1].opacity).toBeCloseTo(1, 4);
  });

  it('cycles the features in order, one at a time', () => {
    const shown = times().map((t) => frame(t).name.findIndex((w) => w.opacity > 0.99)).filter((k) => k >= 0);
    const order = shown.filter((k, i) => k !== shown[i - 1]);

    expect(order).toEqual(Array.from({ length: FEATURES }, (_, k) => k));
    times().forEach((t) => expect(frame(t).name.filter((w) => w.opacity > 0.5).length).toBeLessThanOrEqual(1));
  });

  it('holds every feature still for at least a second and a half', () => {
    for (let k = 0; k < FEATURES; k++) {
      const still = times().filter((t) => frame(t).name[k].opacity > 0.999 && Math.abs(frame(t).name[k].y) < 1e-3);

      expect(still.length / FPS).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('swaps features with a strong expo in-out: still at the ends, fast in the middle, never past the target', () => {
    const k = 1;
    const ys = times().map((t) => frame(t).name[k].y);
    const steps = ys.slice(1).map((y, i) => y - ys[i]);
    const moving = steps.map((s, i) => [i, s] as const).filter(([, s]) => Math.abs(s) > 1e-6);
    const first = moving[0][0];
    const run = steps.slice(first, first + 20).map(Math.abs);

    steps.forEach((s) => expect(s).toBeLessThanOrEqual(1e-9));
    expect(Math.max(...run)).toBeGreaterThan(run[0] * 5);
  });
});
