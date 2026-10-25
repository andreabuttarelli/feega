import { describe, expect, it } from 'vitest';
import { Ease } from '@feega/motion-core/motion/design';
import { easeCss } from './ease-css';
import { sampleTrack } from '@feega/motion-core/motion/keyframes';

const STEPS = 200;

const curve = (ease: Ease, intensity?: number) => {
  const track = [
    { frame: 0, value: 0, ease, intensity },
    { frame: STEPS, value: 1, ease: Ease.Linear }
  ];
  return Array.from({ length: STEPS + 1 }, (_, i) => sampleTrack(track, i));
};

const peak = (values: number[]) => Math.max(...values);

describe('elastic and bounce eases', () => {
  it('elastic overshoots the target, then settles on it', () => {
    const values = curve(Ease.Elastic);

    expect(peak(values)).toBeGreaterThan(1.05);
    expect(values[0]).toBe(0);
    expect(values[STEPS]).toBe(1);
  });

  it('bounce never passes the target and dips back after reaching it', () => {
    const values = curve(Ease.Bounce);
    const nearTarget = values.findIndex((v) => v >= 0.95);

    expect(peak(values)).toBeLessThanOrEqual(1);
    expect(Math.min(...values.slice(nearTarget + 1, STEPS - 1))).toBeLessThan(0.9);
  });

  it('a higher intensity swings further', () => {
    const elastic = [0, 0.25, 0.5, 0.75, 1].map((s) => peak(curve(Ease.Elastic, s)));
    const dip = (s: number) => 1 - Math.min(...curve(Ease.Bounce, s).slice(130, STEPS - 1));

    expect(elastic).toEqual([...elastic].sort((a, b) => a - b));
    expect(elastic[4]).toBeGreaterThan(elastic[0]);
    expect(dip(1)).toBeGreaterThan(dip(0));
  });
});

describe('easeCss', () => {
  it('writes a bezier as cubic-bezier()', () => {
    expect(easeCss([0.25, 0.1, 0.25, 1])).toBe('cubic-bezier(0.25, 0.1, 0.25, 1)');
  });

  it('writes a named bezier ease as cubic-bezier()', () => {
    expect(easeCss(Ease.Enter)).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('writes elastic as a linear() list that ends on 1', () => {
    const css = easeCss(Ease.Elastic, 0.5);

    expect(css.startsWith('linear(0, ')).toBe(true);
    expect(css.endsWith(', 1)')).toBe(true);
  });
});
