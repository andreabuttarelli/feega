import { describe, expect, it } from 'vitest';
import { BLEND_MODES, BlendMode } from '../blend';
import { blended } from './blend-colour';
import type { Rgba } from './rgba';

const backdrop: Rgba = [0.6, 0.4, 0.2, 1];
const source: Rgba = [0.3, 0.5, 0.9, 1];
const rgb = (mode: BlendMode) => blended(backdrop, source, mode).slice(0, 3);

describe('After Effects blend modes', () => {
  it('every mode in the registry has a formula', () => {
    for (const mode of BLEND_MODES) {
      expect(blended(backdrop, source, mode)[3]).toBe(1);
    }
  });

  it.each([
    [BlendMode.LinearBurn, [0, 0, 0.1]],
    [BlendMode.LinearDodge, [0.9, 0.9, 1]],
    [BlendMode.LinearLight, [0.2, 0.4, 1]],
    [BlendMode.HardMix, [0, 0, 1]],
    [BlendMode.Subtract, [0.3, 0, 0]],
    [BlendMode.Divide, [1, 0.8, 0.2222]],
    [BlendMode.PinLight, [0.6, 0.4, 0.8]]
  ])('%s', (mode, expected) => {
    rgb(mode).forEach((v, i) => expect(v).toBeCloseTo(expected[i], 3));
  });

  it('vivid light burns below half and dodges above', () => {
    const [r, , b] = rgb(BlendMode.VividLight);

    expect(r).toBeCloseTo(1 - 0.4 / 0.6, 3);
    expect(b).toBeCloseTo(1, 3);
  });

  it('darker colour keeps the whole darker pixel, lighter colour the lighter one', () => {
    expect(rgb(BlendMode.DarkerColor)).toEqual([0.6, 0.4, 0.2]);
    expect(rgb(BlendMode.LighterColor)).toEqual([0.3, 0.5, 0.9]);
  });
});
