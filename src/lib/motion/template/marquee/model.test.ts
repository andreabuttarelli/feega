import { describe, expect, it } from 'vitest';
import { MARQUEE_MODEL } from './model';

type Plan = { kind: string; main: number; pitch: number; span: number; wraps: number; cruise: number; phase: number };
type Glide = { pos: number; vel: number };
type Sample = { t: number; at: number };
type Model = {
  rowPlan: (p: object, row: number, count: number, length: number) => Plan;
  cruiseAt: (plan: Plan, t: number) => number;
  copiesFor: (plan: Plan, view: number) => number;
  wrapped: (pos: number, span: number) => number;
  glideSteps: (s: Glide, target: number, dt: number, tau: number) => Glide;
  flingOf: (samples: Sample[]) => number;
  dragTo: (grab: { pos: number; at: number }, at: number) => number;
};

const model = new Function(`${MARQUEE_MODEL}; return { rowPlan, cruiseAt, copiesFor, wrapped, glideSteps, flingOf, dragTo };`)() as Model;

const PARAMS = { content: 'logos + quotes', rows: 2, direction: 'left', alternate: true, speed: 0.1, gap: 0.06, itemSize: 0.08, quoteWidth: 0.42 };
const LENGTH = 12;
const FPS = 30;
const VIEW = 16 / 9;

const frames = (length = LENGTH) => Array.from({ length: Math.round(length * FPS) + 1 }, (_, i) => i / FPS);

describe('the marquee model', () => {
  it('wraps a whole number of times per loop, so the last frame is the first', () => {
    for (const p of [PARAMS, { ...PARAMS, speed: 0.37 }, { ...PARAMS, speed: 0.01 }, { ...PARAMS, direction: 'up', content: 'quotes' }]) {
      for (const row of [0, 1]) {
        const plan = model.rowPlan(p, row, 7, LENGTH);

        expect(Number.isInteger(plan.wraps)).toBe(true);
        expect(plan.wraps).toBeGreaterThanOrEqual(1);
        expect(Math.abs(plan.cruise * LENGTH) / plan.span).toBeCloseTo(plan.wraps, 9);
        const drift = model.cruiseAt(plan, LENGTH) - model.cruiseAt(plan, 0);
        expect(model.wrapped(drift + plan.span / 2, plan.span) - plan.span / 2).toBeCloseTo(0, 9);
      }
    }
  });

  it('keeps the asked speed within one wrap of rounding', () => {
    const plan = model.rowPlan(PARAMS, 0, 3, LENGTH);

    expect(Math.abs(Math.abs(plan.cruise) - PARAMS.speed)).toBeLessThanOrEqual(plan.span / LENGTH / 2 + 1e-9);
  });

  it('has no seam: the offset only jumps by exactly one span, where the content repeats', () => {
    const plan = model.rowPlan(PARAMS, 0, 6, LENGTH);
    const at = frames().map((t) => model.cruiseAt(plan, t));
    const step = Math.abs(plan.cruise) / FPS;

    at.slice(1).forEach((x, i) => {
      const d = x - at[i];
      const across = model.wrapped(d + plan.span / 2, plan.span) - plan.span / 2;
      expect(Math.abs(across + step), `frame ${i}`).toBeLessThan(1e-9);
      expect([0, plan.span]).toContainEqual(expect.closeTo(Math.abs(d - across), 9));
    });
  });

  it('moves at constant speed: every frame steps the same sub-pixel distance', () => {
    const plan = model.rowPlan(PARAMS, 0, 6, LENGTH);
    const steps = frames().slice(1).map((t, i) => model.wrapped(model.cruiseAt(plan, t) - model.cruiseAt(plan, frames()[i]) + plan.span / 2, plan.span) - plan.span / 2);

    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(1e-9);
    expect(steps.every((s) => !Number.isInteger(s * 1080))).toBe(true);
  });

  it('runs opposite rows the other way, and follows the direction', () => {
    const sign = (p: object, row: number) => Math.sign(model.rowPlan(p, row, 6, LENGTH).cruise);

    expect([sign(PARAMS, 0), sign(PARAMS, 1)]).toEqual([-1, 1]);
    expect([sign({ ...PARAMS, direction: 'right' }, 0), sign({ ...PARAMS, alternate: false }, 1)]).toEqual([1, -1]);
    expect([sign({ ...PARAMS, direction: 'up' }, 0), sign({ ...PARAMS, direction: 'down' }, 0)]).toEqual([-1, 1]);
  });

  it('alternates logos and quotes rows, and measures a column on its height', () => {
    expect([model.rowPlan(PARAMS, 0, 6, LENGTH).kind, model.rowPlan(PARAMS, 1, 6, LENGTH).kind]).toEqual(['logos', 'quotes']);
    expect(model.rowPlan({ ...PARAMS, direction: 'up' }, 1, 6, LENGTH).main).toBeLessThan(model.rowPlan(PARAMS, 1, 6, LENGTH).main);
  });

  it('lays enough copies to cover the view whatever the offset', () => {
    for (const count of [1, 3, 12]) {
      const plan = model.rowPlan(PARAMS, 0, count, LENGTH);
      const copies = model.copiesFor(plan, VIEW);

      for (const t of frames().filter((_, i) => i % 7 === 0)) {
        const start = model.cruiseAt(plan, t) - plan.span;
        expect(start).toBeLessThanOrEqual(0);
        expect(start + copies * plan.span).toBeGreaterThanOrEqual(VIEW);
      }
    }
  });

  it('is a pure function of t: any seek order gives the same offset', () => {
    const plan = model.rowPlan(PARAMS, 1, 6, LENGTH);
    const at = [0.4, 3, 7.2, 11.6];
    const forward = at.map((t) => model.cruiseAt(plan, t));
    const backward = [...at].reverse().map((t) => model.cruiseAt(plan, t)).reverse();

    expect(backward).toEqual(forward);
  });

  it('follows the pointer 1:1 while held', () => {
    const grab = { pos: 0.3, at: 0.5 };

    expect(model.dragTo(grab, 0.62)).toBeCloseTo(0.42, 12);
    expect(model.dragTo(grab, 0.1)).toBeCloseTo(-0.1, 12);
  });

  it('reads the release speed from the last tenth of a second', () => {
    const samples = [
      { t: 0, at: 0 },
      { t: 0.5, at: 0.01 },
      { t: 0.55, at: 0.06 },
      { t: 0.6, at: 0.11 }
    ];

    expect(model.flingOf(samples)).toBeCloseTo(1, 9);
    expect(model.flingOf([{ t: 1, at: 0.2 }])).toBe(0);
  });

  it('glides back to cruise without overshooting, reversing or jumping', () => {
    const cruise = -0.1;
    for (const fling of [-2, -0.1, 0, 1.5]) {
      let s = { pos: 0, vel: fling };
      const vels = [fling];
      for (let i = 0; i < 6 * 60; i++) {
        s = model.glideSteps(s, cruise, 1 / 60, 0.6);
        vels.push(s.vel);
      }
      const gaps = vels.map((v) => v - cruise);

      gaps.slice(1).forEach((g, i) => {
        expect(Math.abs(g)).toBeLessThanOrEqual(Math.abs(gaps[i]) + 1e-12);
        expect(Math.sign(g) * Math.sign(gaps[i])).not.toBe(-1);
      });
      expect(vels.at(-1)!).toBeCloseTo(cruise, 3);
      const flungWithCruise = Math.sign(fling) === Math.sign(cruise);
      if (flungWithCruise) {
        expect(vels.every((v) => Math.sign(v) === Math.sign(cruise))).toBe(true);
      }
    }
  });

  it('glides the same at any frame rate', () => {
    const start = { pos: 0, vel: 1.2 };
    const at60 = Array.from({ length: 60 }).reduce<Glide>((s) => model.glideSteps(s, -0.1, 1 / 60, 0.6), start);
    const at144 = Array.from({ length: 144 }).reduce<Glide>((s) => model.glideSteps(s, -0.1, 1 / 144, 0.6), start);
    const once = model.glideSteps(start, -0.1, 1, 0.6);

    expect(at144.pos).toBeCloseTo(at60.pos, 9);
    expect(once.pos).toBeCloseTo(at60.pos, 9);
    expect(once.vel).toBeCloseTo(at60.vel, 9);
  });
});
