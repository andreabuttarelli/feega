import { describe, expect, it } from 'vitest';
import { budgetOf, budgetMs, FRAME_BUDGET_MS, Rate } from './frame-budget';

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

  it('a 120 fps frame is 8.3 ms, and a 10 ms frame is over it but inside 90 fps', () => {
    const tens = [...Array(97).fill(5), ...Array(3).fill(10)];
    expect(budgetMs(Rate.ProMotion)).toBeCloseTo(8.3, 1);
    expect(budgetOf(tens, Rate.ProMotion)).toMatchObject({ over: 3, passed: false });
    expect(budgetOf(tens).passed).toBe(true);
  });

  it('no frames is a failure, not a pass', () => {
    expect(budgetOf([]).passed).toBe(false);
  });
});
