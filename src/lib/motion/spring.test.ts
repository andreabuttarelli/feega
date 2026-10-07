import { describe, expect, it } from 'vitest';
import { SPRINGS, edgePair, loopChanges, overshootOf, settleTime, springKernel, springTrack, sumSteps, sumVelocity, trackChanges, type Spring } from './spring';

const SNAPPY: Spring = SPRINGS.ui;
const EPS = 1e-9;
const H = 1e-4;

const slope = (f: (t: number) => number, t: number) => (f(t + H) - f(t - H)) / (2 * H);

describe('a spring in closed form', () => {
  it('is a pure function of time: the same instant gives the same value whatever was asked before', () => {
    const keys = [[0, 0], [0.5, 100], [0.8, -40]] as const;
    const forward = [0.1, 0.6, 0.9, 1.4].map((t) => springTrack(keys, t, SNAPPY));
    const backward = [1.4, 0.9, 0.6, 0.1].map((t) => springTrack(keys, t, SNAPPY)).reverse();

    expect(backward).toEqual(forward);
  });

  it('starts at rest on its first value and settles on its last', () => {
    const keys = [[0.2, 10], [0.4, 90]] as const;

    expect(springTrack(keys, 0, SNAPPY)).toBe(10);
    expect(springTrack(keys, 0.4, SNAPPY)).toBe(10);
    expect(springTrack(keys, 0.4 + settleTime(SNAPPY) * 2, SNAPPY)).toBeCloseTo(90, 3);
  });

  it.each([
    ['under-damped', { stiffness: 300, damping: 20 }],
    ['critically damped', { stiffness: 400, damping: 40 }],
    ['over-damped', { stiffness: 200, damping: 60 }]
  ])('the %s kernel satisfies x" = -k x - c v', (_, spring) => {
    const at = (t: number) => springKernel(spring.stiffness, spring.damping, t, 1, 2)[0];
    for (const t of [0.01, 0.1, 0.3]) {
      const [x, v] = springKernel(spring.stiffness, spring.damping, t, 1, 2);
      const accel = (slope(at, t + H) - slope(at, t - H)) / (2 * H);

      expect(slope(at, t)).toBeCloseTo(v, 3);
      expect(accel).toBeCloseTo(-spring.stiffness * x - spring.damping * v, 0);
    }
  });

  it('a retarget mid-flight keeps position and velocity continuous', () => {
    const keys = [[0, 0], [0.3, 100], [0.45, 20]] as const;
    const f = (t: number) => springTrack(keys, t, SNAPPY);

    expect(Math.abs(f(0.45 + EPS) - f(0.45 - EPS))).toBeLessThan(1e-6);
    const steps = trackChanges(keys, SNAPPY);
    expect(sumVelocity(steps, 0.45 + EPS)).toBeCloseTo(sumVelocity(steps, 0.45 - EPS), 4);
    expect(slope(f, 0.6)).toBeCloseTo(sumVelocity(steps, 0.6), 2);
  });

  it('the library springs overshoot by less than 2% of the move', () => {
    for (const spring of Object.values(SPRINGS)) {
      const peak = Math.max(...Array.from({ length: 400 }, (_, i) => springTrack([[0, 0], [0, 1]], i / 200, spring)));

      expect(overshootOf(spring)).toBeLessThan(0.02);
      expect(peak - 1).toBeLessThanOrEqual(overshootOf(spring) + 1e-9);
    }
  });

  it('a looped track has the same value and velocity at the end of the cycle as at the start', () => {
    const period = 2;
    const changes = loopChanges([[0, 0], [0.5, 100], [1.2, 30]], period, SNAPPY);
    const f = (t: number) => sumSteps(0, changes, ((t % period) + period) % period, period);

    expect(f(period - EPS)).toBeCloseTo(f(0), 6);
    expect(sumVelocity(changes, period - EPS, period)).toBeCloseTo(sumVelocity(changes, 0, period), 4);
  });

  it('the leading edge of a pair outruns the trailing one, so the shape stretches toward where it goes', () => {
    const keys = [[0, 0, 100], [0.2, 200, 300]] as const;
    const [lo, hi] = edgePair(keys, 0.3, SPRINGS.lead, SPRINGS.trail);

    expect(hi - lo).toBeGreaterThan(100);
    expect(hi / 300).toBeGreaterThan(lo / 200);
  });

  it('turns a list of retargets into steps with their own springs', () => {
    expect(trackChanges([[0, 1], [1, 3], [2, 3]], SNAPPY)).toEqual([{ at: 1, delta: 2, spring: SNAPPY }]);
  });
});
