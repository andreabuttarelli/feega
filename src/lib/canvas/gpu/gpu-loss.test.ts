import { describe, expect, it } from 'vitest';
import { AttachStep, FRESH_CORES, LOSSES_PER_BACKEND, afterAttachFailure, afterLoss } from './gpu-loss';

const BACKENDS = 3;

describe('a core that keeps losing its device', () => {
  it('attaches again while it has losses to spare', () => {
    expect(afterLoss(0, 1, BACKENDS)).toEqual({ step: AttachStep.FreshCore, backend: 0 });
  });

  it('moves down a backend after repeated losses', () => {
    expect(afterLoss(0, LOSSES_PER_BACKEND, BACKENDS)).toEqual({ step: AttachStep.NextBackend, backend: 1 });
  });

  it('gives up instead of looping when the last backend keeps losing it', () => {
    expect(afterLoss(BACKENDS - 1, LOSSES_PER_BACKEND, BACKENDS)).toEqual({ step: AttachStep.GiveUp, backend: BACKENDS - 1 });
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
