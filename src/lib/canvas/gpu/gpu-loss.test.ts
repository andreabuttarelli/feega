import { describe, expect, it } from 'vitest';
import { LOSSES_PER_BACKEND, backendAfterLoss } from './gpu-loss';

const BACKENDS = 3;

describe('the canvas after a lost GPU', () => {
  it('attaches again on the same backend after a single loss', () => {
    expect(backendAfterLoss(0, 1, BACKENDS)).toBe(0);
  });

  it('steps down to the next backend once one keeps losing its device', () => {
    expect(backendAfterLoss(0, LOSSES_PER_BACKEND, BACKENDS)).toBe(1);
  });

  it('stays on the last backend, it has nowhere lower to go', () => {
    expect(backendAfterLoss(BACKENDS - 1, LOSSES_PER_BACKEND, BACKENDS)).toBe(BACKENDS - 1);
  });
});
