import { describe, expect, it } from 'vitest';
import { LATTICE, latticeOf, stitchedFrequency } from './turbulence';

describe('latticeOf', () => {
  const { selector, gradients } = latticeOf(3);

  it('shuffles a permutation of the 256 lattice points and repeats it past the end', () => {
    expect([...selector.slice(0, 256)].sort((a, b) => a - b)).toEqual(Array.from({ length: 256 }, (_, i) => i));
    expect(selector[256]).toBe(selector[0]);
    expect(selector.length).toBe(LATTICE);
  });

  it('gives every channel unit-length gradients', () => {
    for (let k = 0; k < 4; k++) {
      const [x, y] = [gradients[(k * LATTICE + 7) * 2], gradients[(k * LATTICE + 7) * 2 + 1]];
      expect(Math.hypot(x, y)).toBeCloseTo(1, 6);
    }
  });

  it('depends on the seed', () => {
    expect(latticeOf(4).selector.slice(0, 8)).not.toEqual(selector.slice(0, 8));
  });
});

describe('stitchedFrequency', () => {
  it('snaps the base frequency to a whole number of periods across the tile', () => {
    expect(stitchedFrequency(0.6667, 256) * 256).toBeCloseTo(171);
    expect(stitchedFrequency(0, 256)).toBe(0);
  });
});
