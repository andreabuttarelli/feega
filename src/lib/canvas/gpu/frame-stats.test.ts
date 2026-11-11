// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { countFrame } from './frame-stats';

describe('countFrame', () => {
  beforeEach(() => {
    delete window.__gpuCanvas;
  });

  it('keeps what the core did in each frame, named, beside the frame length and whether the camera moved', () => {
    countFrame(performance.now(), Float64Array.from([2, 20000, 1.5, 3, 4.5, 4096]), true);

    expect(window.__gpuCanvas?.frames?.[0]).toMatchObject({ moving: true, plans: 2, walked: 20000, planMs: 1.5, bakes: 3, bakeMs: 4.5, uploadBytes: 4096 });
  });

  it('counts zero work for a core that reports none', () => {
    countFrame(performance.now(), undefined, false);

    expect(window.__gpuCanvas?.frames?.[0]).toMatchObject({ moving: false, plans: 0, bakes: 0, uploadBytes: 0 });
  });
});
