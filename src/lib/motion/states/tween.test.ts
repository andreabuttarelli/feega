import { describe, expect, it } from 'vitest';
import { Ease } from '@feega/motion-core/motion/design';
import { amountAt } from './tween';

const run = { from: 0, to: 1, startedAt: 1000, transition: { easing: Ease.Linear, durationMs: 200 } };

describe('state tween', () => {
  it('moves from the start amount to the end over the duration', () => {
    expect(amountAt(run, 1000)).toBe(0);
    expect(amountAt(run, 1100)).toBeCloseTo(0.5, 1);
    expect(amountAt(run, 1300)).toBe(1);
  });

  it('runs backwards when leaving the state', () => {
    expect(amountAt({ ...run, from: 1, to: 0 }, 1300)).toBe(0);
  });

  it('a zero duration jumps', () => {
    expect(amountAt({ ...run, transition: { easing: Ease.Standard, durationMs: 0 } }, 1000)).toBe(1);
  });
});
