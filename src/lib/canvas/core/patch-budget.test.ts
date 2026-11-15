import { describe, expect, it } from 'vitest';
import { PatchBudget, PATCH_BUDGET_MS, RETRY_AFTER, SLOW_STRIKES } from './patch-budget';

const SLOW = PATCH_BUDGET_MS + 1;

const slowTimes = (budget: PatchBudget, key: string, times: number) => Array.from({ length: times }, () => budget.took(key, SLOW));

describe('PatchBudget', () => {
  it('keeps redraw patches on for a layer whose patches stay inside the budget', () => {
    const budget = new PatchBudget();

    budget.took('f1|a', PATCH_BUDGET_MS - 1);

    expect(budget.redraws('f1|a')).toBe(true);
  });

  it('keeps redraws on after one slow patch, which may only be a cold first layout', () => {
    const budget = new PatchBudget();

    slowTimes(budget, 'f1|a', SLOW_STRIKES - 1);

    expect(budget.redraws('f1|a')).toBe(true);
  });

  it('turns redraws off for a layer whose patches keep costing more than the worker would', () => {
    const budget = new PatchBudget();

    slowTimes(budget, 'f1|a', SLOW_STRIKES);

    expect(budget.redraws('f1|a')).toBe(false);
    expect(budget.redraws('f1|b')).toBe(true);
  });

  it('gives a dropped layer another try after a few edits on the worker', () => {
    const budget = new PatchBudget();
    slowTimes(budget, 'f1|a', SLOW_STRIKES);

    Array.from({ length: RETRY_AFTER }, () => budget.redraws('f1|a'));

    expect(budget.redraws('f1|a')).toBe(true);
  });

  it('gives every layer of a frame its redraws back when the frame doc is replaced', () => {
    const budget = new PatchBudget();
    slowTimes(budget, 'f1|a', SLOW_STRIKES);
    slowTimes(budget, 'f10|a', SLOW_STRIKES);

    budget.forgetFrame('f1');

    expect(budget.redraws('f1|a')).toBe(true);
    expect(budget.redraws('f10|a')).toBe(false);
  });
});

describe('PatchBudget against the worker', () => {
  it('keeps a patch slower than the default budget when the frame worker build is slower still', () => {
    const budget = new PatchBudget();
    budget.built('f1', 4 * PATCH_BUDGET_MS);

    Array.from({ length: SLOW_STRIKES }, () => budget.took('f1|a', 2 * PATCH_BUDGET_MS));

    expect(budget.redraws('f1|a')).toBe(true);
  });

  it('drops a patch slower than the frame worker build', () => {
    const budget = new PatchBudget();
    budget.built('f1', 4 * PATCH_BUDGET_MS);

    Array.from({ length: SLOW_STRIKES }, () => budget.took('f1|a', 5 * PATCH_BUDGET_MS));

    expect(budget.redraws('f1|a')).toBe(false);
  });
});
