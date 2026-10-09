import { describe, expect, it } from 'vitest';
import { motionEngine, type EaseFn } from './engine';

const engine = motionEngine({} as Window & Record<string, unknown>);
const SAMPLES = 2000;
const MAX_SETTLE = 0.02;

const samples = (ease: EaseFn) => Array.from({ length: SAMPLES + 1 }, (_, i) => ease(i / SAMPLES));

function peakOf(values: number[]) {
  const peak = Math.max(...values);
  return { peak, at: values.indexOf(peak) };
}

const rises = (values: number[], to: number) => values.slice(0, to + 1).every((v, i) => i === 0 || v >= values[i - 1]);
const falls = (values: number[], from: number) => values.slice(from).every((v, i, all) => i === 0 || v <= all[i - 1]);

describe('the house curves', () => {
  for (const name of ['feega.out', 'feega.inOut', 'feega.in']) {
    it(`${name} starts at 0, ends at 1, rises to its peak and only settles after it`, () => {
      const values = samples(engine.parseEase(name));
      const { peak, at } = peakOf(values);
      expect(values[0]).toBe(0);
      expect(values[SAMPLES]).toBe(1);
      expect(rises(values, at)).toBe(true);
      expect(falls(values, at)).toBe(true);
      expect(peak - 1).toBeLessThanOrEqual(MAX_SETTLE);
    });
  }

  it('feega.out and feega.inOut lean into a soft settle, never a visible bounce', () => {
    for (const name of ['feega.out', 'feega.inOut']) {
      const overshoot = peakOf(samples(engine.parseEase(name))).peak - 1;
      expect(overshoot).toBeGreaterThan(0.002);
      expect(overshoot).toBeLessThanOrEqual(MAX_SETTLE);
    }
  });

  it('feega.inOut is accentuated like expo: barely moving at a quarter, nearly there at three quarters', () => {
    const ease = engine.parseEase('feega.inOut');
    expect(ease(0.25)).toBeLessThanOrEqual(0.05);
    expect(ease(0.5)).toBeCloseTo(0.5, 2);
    expect(ease(0.75)).toBeGreaterThanOrEqual(0.95);
  });

  it('feega.out covers most of the way in the first quarter', () => {
    expect(engine.parseEase('feega.out')(0.25)).toBeGreaterThanOrEqual(0.8);
  });

  it('feega.in leaves slowly and accelerates away', () => {
    const ease = engine.parseEase('feega.in');
    expect(ease(0.5)).toBeLessThanOrEqual(0.05);
    expect(ease(0.9)).toBeGreaterThanOrEqual(0.4);
  });

  it('a tween with no ease runs on feega.out', () => {
    const out = engine.parseEase('feega.out');
    for (const p of [0.1, 0.3, 0.6, 0.9]) {
      expect(engine.parseEase(undefined)(p)).toBe(out(p));
      expect(engine.parseEase('no-such-ease')(p)).toBe(out(p));
    }
  });
});
