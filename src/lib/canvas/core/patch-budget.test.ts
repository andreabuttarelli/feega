import { describe, expect, it } from 'vitest';
import { PatchBudget, PATCH_BUDGET_MS } from './patch-budget';

describe('PatchBudget', () => {
  it('keeps redraw patches on for a frame whose patches stay inside the budget', () => {
    const budget = new PatchBudget();

    budget.took('f1', PATCH_BUDGET_MS - 1);

    expect(budget.redraws('f1')).toBe(true);
  });

  it('turns redraw patches off for a frame once one costs more than the worker would', () => {
    const budget = new PatchBudget();

    budget.took('f1', PATCH_BUDGET_MS + 1);

    expect(budget.redraws('f1')).toBe(false);
    expect(budget.redraws('f2')).toBe(true);
  });

  it('gives a frame its redraws back when its doc is replaced', () => {
    const budget = new PatchBudget();
    budget.took('f1', PATCH_BUDGET_MS + 1);

    budget.forget('f1');

    expect(budget.redraws('f1')).toBe(true);
  });
});
