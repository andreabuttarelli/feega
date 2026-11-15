import { describe, expect, it } from 'vitest';
import { PatchBudget, PATCH_BUDGET_MS, PATCH_MOST_MS, SLOW_STRIKES, STRIKE_WINDOW_MS } from './patch-budget';

const SLOW = PATCH_BUDGET_MS + 1;
const FAST = 1;

function clocked() {
  let at = 0;
  const budget = new PatchBudget(() => at);
  return { budget, wait: (ms: number) => (at += ms) };
}

const warmed = (budget: PatchBudget, key: string) => budget.took(key, SLOW);

const slowTimes = (budget: PatchBudget, key: string, times: number) => Array.from({ length: times }, () => budget.took(key, SLOW));

describe('PatchBudget', () => {
  it('keeps redraw patches on for a layer whose patches stay inside the budget', () => {
    const { budget } = clocked();

    budget.took('f1|a', FAST);

    expect(budget.redraws('f1|a')).toBe(true);
  });

  it('does not count the first patch of a layer, which pays the cold layout', () => {
    const { budget } = clocked();

    warmed(budget, 'f1|a');
    slowTimes(budget, 'f1|a', SLOW_STRIKES - 1);

    expect(budget.redraws('f1|a')).toBe(true);
  });

  it('turns redraws off for a layer whose patches keep costing more than the worker would', () => {
    const { budget } = clocked();
    warmed(budget, 'f1|a');

    slowTimes(budget, 'f1|a', SLOW_STRIKES);

    expect(budget.redraws('f1|a')).toBe(false);
    expect(budget.redraws('f1|b')).toBe(true);
  });

  it('gives a layer its redraws back after a fast patch', () => {
    const { budget } = clocked();
    warmed(budget, 'f1|a');
    slowTimes(budget, 'f1|a', SLOW_STRIKES);

    budget.took('f1|a', FAST);

    expect(budget.redraws('f1|a')).toBe(true);
  });

  it('forgets slow patches older than the strike window', () => {
    const { budget, wait } = clocked();
    warmed(budget, 'f1|a');
    slowTimes(budget, 'f1|a', SLOW_STRIKES);

    wait(STRIKE_WINDOW_MS + 1);

    expect(budget.redraws('f1|a')).toBe(true);
  });

  it('gives every layer of a frame its redraws back when the frame doc is replaced', () => {
    const { budget } = clocked();
    for (const key of ['f1|a', 'f10|a']) {
      warmed(budget, key);
      slowTimes(budget, key, SLOW_STRIKES);
    }

    budget.forgetFrame('f1');

    expect(budget.redraws('f1|a')).toBe(true);
    expect(budget.redraws('f10|a')).toBe(false);
  });
});

describe('PatchBudget against the worker', () => {
  it('keeps a patch slower than the default budget when the frame worker build is slower still', () => {
    const { budget } = clocked();
    budget.built('f1', 4 * PATCH_BUDGET_MS);
    warmed(budget, 'f1|a');

    Array.from({ length: SLOW_STRIKES }, () => budget.took('f1|a', 2 * PATCH_BUDGET_MS));

    expect(budget.redraws('f1|a')).toBe(true);
  });

  it('drops a patch slower than the frame worker build', () => {
    const { budget } = clocked();
    budget.built('f1', 4 * PATCH_BUDGET_MS);
    warmed(budget, 'f1|a');

    Array.from({ length: SLOW_STRIKES }, () => budget.took('f1|a', 5 * PATCH_BUDGET_MS));

    expect(budget.redraws('f1|a')).toBe(false);
  });

  it('drops a patch slower than a frame, however slow the worker build looks', () => {
    const { budget } = clocked();
    budget.built('f1', 10 * PATCH_MOST_MS);
    warmed(budget, 'f1|a');

    Array.from({ length: SLOW_STRIKES }, () => budget.took('f1|a', 2 * PATCH_MOST_MS));

    expect(budget.redraws('f1|a')).toBe(false);
  });
});
