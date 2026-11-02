import { describe, expect, it } from 'vitest';
import { AttachStep, FRESH_CORES, LOSSES_PER_BACKEND, afterAttachFailure, backendAfterLoss } from './gpu-loss';

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

describe('the canvas after a failed attach', () => {
  const trap = new WebAssembly.RuntimeError('unreachable');

  it('reloads the core and tries the same backend when the core trapped', () => {
    expect(afterAttachFailure(trap, 0, 0, BACKENDS)).toEqual({ step: AttachStep.FreshCore, backend: 0 });
  });

  it('reloads the core even on the last backend', () => {
    expect(afterAttachFailure(trap, BACKENDS - 1, 0, BACKENDS)).toEqual({ step: AttachStep.FreshCore, backend: BACKENDS - 1 });
  });

  it('moves to the next backend when the backend itself is missing', () => {
    expect(afterAttachFailure(new Error('webgpu unavailable'), 0, 0, BACKENDS)).toEqual({ step: AttachStep.NextBackend, backend: 1 });
  });

  it('stops reloading a core that keeps trapping', () => {
    expect(afterAttachFailure(trap, 0, FRESH_CORES, BACKENDS)).toEqual({ step: AttachStep.NextBackend, backend: 1 });
  });

  it('gives up only on the last backend', () => {
    expect(afterAttachFailure(new Error('webgl2 unavailable'), BACKENDS - 1, 0, BACKENDS)).toEqual({ step: AttachStep.GiveUp, backend: BACKENDS - 1 });
  });
});
