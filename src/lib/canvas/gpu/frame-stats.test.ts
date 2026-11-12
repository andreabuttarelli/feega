// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { countFrame } from './frame-stats';

describe('countFrame', () => {
  beforeEach(() => {
    delete window.__gpuCanvas;
  });

  it('keeps what the core did in each frame, named, beside the frame length and whether the camera moved', () => {
    countFrame(performance.now(), Float64Array.from([2, 20000, 1.5, 3, 4.5, 4096, 7, 5, -6, 12, 5, 2, 4, 65536]), true, true);

    expect(window.__gpuCanvas?.frames?.[0]).toMatchObject({ moving: true, plans: 2, walked: 20000, planMs: 1.5, bakes: 3, bakeMs: 4.5, uploadBytes: 4096, unsharp: 7, uncovered: 5, step: -6, tiles: 12, draws: 5, uploads: 2, stillBlocks: 4, heldBytes: 65536, pending: true });
  });

  it('counts zero work for a core that reports none', () => {
    countFrame(performance.now(), undefined, false, false);

    expect(window.__gpuCanvas?.frames?.[0]).toMatchObject({ moving: false, plans: 0, bakes: 0, uploadBytes: 0, unsharp: 0, tiles: 0, draws: 0, uploads: 0, stillBlocks: 0, heldBytes: 0, pending: false });
  });
});
