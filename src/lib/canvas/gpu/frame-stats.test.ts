// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { LossKind, countFrame } from './frame-stats';

describe('countFrame', () => {
  beforeEach(() => {
    delete window.__gpuCanvas;
  });

  it('keeps what the core did in each frame, named, beside the frame length and whether the camera moved', () => {
    countFrame(performance.now(), Float64Array.from([2, 20000, 1.5, 3, 4.5, 4096, 7, 5, -6, 12, 5, 2]), true, true);

    expect(window.__gpuCanvas?.frames?.[0]).toMatchObject({ moving: true, plans: 2, walked: 20000, planMs: 1.5, bakes: 3, bakeMs: 4.5, uploadBytes: 4096, unsharp: 7, uncovered: 5, step: -6, tiles: 12, draws: 5, uploads: 2, pending: true });
  });

  it('counts zero work for a core that reports none', () => {
    countFrame(performance.now(), undefined, false, false);

    expect(window.__gpuCanvas?.frames?.[0]).toMatchObject({ moving: false, plans: 0, bakes: 0, uploadBytes: 0, unsharp: 0, tiles: 0, draws: 0, uploads: 0, pending: false });
  });
});

describe('watching what the screen loses', () => {
  beforeEach(() => {
    delete window.__gpuCanvas;
  });

  it('counts the visible losses of each frame', () => {
    countFrame(performance.now(), Float64Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1]), false, false);

    expect(window.__gpuCanvas?.frames?.[0]).toMatchObject({ lost: 3, evictedSeen: 1 });
  });

  it('keeps each loss named, with the tile it hit', () => {
    const counts = new Array(19).fill(0);
    countFrame(performance.now(), Float64Array.from([...counts, 1000, 1, 4, 2, 3, 1001, 3, 2, 0, 0]), false, false);

    expect(window.__gpuCanvas?.losses).toEqual([
      { at: 1000, kind: LossKind.Coarser, step: 4, tx: 2, ty: 3 },
      { at: 1001, kind: LossKind.EvictedOnScreen, step: 2, tx: 0, ty: 0 }
    ]);
  });
});
