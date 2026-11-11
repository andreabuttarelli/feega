import { describe, expect, it } from 'vitest';
import { budgetOf, FRAME_BUDGET_MS } from './frame-budget.mjs';

const frames = (fast: number, slow: number) => [...Array(fast).fill(5), ...Array(slow).fill(20)];

describe('frame budget', () => {
  it('a 90 fps frame is 11.1 ms', () => {
    expect(FRAME_BUDGET_MS).toBeCloseTo(11.1, 1);
  });

  it('passes when p95 is inside the budget and at most 2% of frames are over', () => {
    expect(budgetOf(frames(98, 2))).toMatchObject({ p95: 5, over: 2, frames: 100, passed: true });
  });

  it('fails when more than 2% of frames are over, even with p95 inside', () => {
    expect(budgetOf(frames(97, 3)).passed).toBe(false);
  });

  it('fails when p95 is over the budget', () => {
    expect(budgetOf(frames(90, 10))).toMatchObject({ p95: 20, passed: false });
  });

  it('reports p99 from the slowest frames', () => {
    expect(budgetOf(frames(995, 5)).p99).toBe(5);
    expect(budgetOf(frames(980, 20)).p99).toBe(20);
  });

  it('no frames is a failure, not a pass', () => {
    expect(budgetOf([]).passed).toBe(false);
  });
});
