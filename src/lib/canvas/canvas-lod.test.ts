import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lodGate } from './canvas-lod.svelte';
import { LOD_SETTLE_MS, LOD_ZOOM } from './poster-lod';

describe('lod gate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('nothing switches while the gesture runs, even past the threshold', () => {
    const gate = lodGate(LOD_SETTLE_MS);
    for (let zoom = 1; zoom > LOD_ZOOM / 2; zoom -= 0.05) {
      gate.view(zoom);
      vi.advanceTimersByTime(16);
    }

    expect(gate.moving).toBe(true);
    expect(gate.far).toBe(false);
  });

  it('the switch lands once, when the gesture settles', () => {
    const gate = lodGate(LOD_SETTLE_MS);
    gate.view(LOD_ZOOM / 2);
    vi.advanceTimersByTime(LOD_SETTLE_MS);

    expect(gate.moving).toBe(false);
    expect(gate.far).toBe(true);
  });

  it('settling keeps the exit band against flicker', () => {
    const gate = lodGate(LOD_SETTLE_MS);
    gate.view(LOD_ZOOM / 2);
    vi.advanceTimersByTime(LOD_SETTLE_MS);
    gate.view(LOD_ZOOM * 1.01);
    vi.advanceTimersByTime(LOD_SETTLE_MS);

    expect(gate.far).toBe(true);
  });
});
