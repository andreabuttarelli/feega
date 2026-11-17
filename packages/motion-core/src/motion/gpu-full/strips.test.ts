import { describe, expect, it } from 'vitest';
import { FullBackend } from './backends';
import { STRIP_PX, stripsFor } from './strips';

describe('a tall frame plays in strips each canvas can hold', () => {
  it('cuts a page taller than one strip into strips that cover it exactly', () => {
    const strips = stripsFor(FullBackend.CoreGl, { width: 1440, height: 4632 });

    expect(strips.every((s) => s.height <= STRIP_PX)).toBe(true);
    expect(strips.reduce((sum, s) => sum + s.height, 0)).toBe(4632);
    expect(strips.map((s) => s.top)).toEqual(strips.map((_, i) => i * STRIP_PX));
  });

  it('keeps a frame that fits in one canvas', () => {
    expect(stripsFor(FullBackend.Core, { width: 1920, height: 1080 })).toEqual([{ top: 0, height: 1080 }]);
  });

  it('keeps the plain WebGL backend whole, since it cannot draw from an origin', () => {
    expect(stripsFor(FullBackend.WebGl2, { width: 1440, height: 4632 })).toEqual([{ top: 0, height: 4632 }]);
  });
});
