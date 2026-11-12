import { describe, expect, it } from 'vitest';
import { levelSharpMs, softwareAdapter } from './bench-stats.mjs';

describe('bench adapter', () => {
  it('a SwiftShader adapter is software rendering, not the app on a GPU', () => {
    expect(softwareAdapter({ vendor: 'google', architecture: 'swiftshader', description: 'SwiftShader Device (Subzero)' })).toBe(true);
  });

  it('a real GPU or an unknown adapter counts as measured', () => {
    expect(softwareAdapter({ vendor: 'apple', architecture: 'metal-3', description: '' })).toBe(false);
    expect(softwareAdapter(null)).toBe(false);
  });
});

describe('time to sharp after a level change', () => {
  const frame = (at: number, step: number, unsharp: number) => ({ at, step, unsharp });

  it('counts from the first frame at a new level to the first frame there with nothing unsharp', () => {
    const frames = [frame(0, 1, 0), frame(8, 2, 40), frame(16, 2, 12), frame(24, 2, 0), frame(32, 2, 0)];
    expect(levelSharpMs(frames)).toEqual({ times: [16], superseded: 0 });
  });

  it('a level left before it sharpened is superseded, not timed', () => {
    const frames = [frame(0, 1, 0), frame(8, 2, 40), frame(16, 3, 30), frame(24, 3, 0)];
    expect(levelSharpMs(frames)).toEqual({ times: [8], superseded: 1 });
  });

  it('a level already sharp on arrival takes no time', () => {
    expect(levelSharpMs([frame(0, 1, 5), frame(8, 2, 0)])).toEqual({ times: [0], superseded: 0 });
  });
});
