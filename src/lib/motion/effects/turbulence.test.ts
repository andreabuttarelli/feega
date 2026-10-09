import { describe, expect, it } from 'vitest';
import { GRAIN_SAMPLE_OFFSET, turbulenceTile } from './turbulence';

const pixel = (tile: Uint8ClampedArray, size: number, x: number, y: number) => Array.from(tile.slice((y * size + x) * 4, (y * size + x) * 4 + 4));
const near = (actual: number[], expected: number[]) => actual.forEach((v, i) => expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(1));

describe('turbulenceTile', () => {
  it('rifà il feTurbulence fractalNoise di Chromium e WebKit', () => {
    const tile = turbulenceTile({ baseFrequency: 0.25, seed: 0, octaves: 1, size: 256, offset: GRAIN_SAMPLE_OFFSET });
    near(pixel(tile, 256, 100, 0), [147, 155, 146, 166]);
  });

  it('a frequenza 1 i punti cadono sul reticolo: grigio medio', () => {
    const tile = turbulenceTile({ baseFrequency: 1, seed: 0, octaves: 1, size: 256, offset: GRAIN_SAMPLE_OFFSET });
    expect(pixel(tile, 256, 17, 40)).toEqual([128, 128, 128, 128]);
  });

  it('semi diversi danno grane diverse', () => {
    const a = turbulenceTile({ baseFrequency: 0.25, seed: 0, octaves: 1, size: 64, offset: GRAIN_SAMPLE_OFFSET });
    const b = turbulenceTile({ baseFrequency: 0.25, seed: 7, octaves: 1, size: 64, offset: GRAIN_SAMPLE_OFFSET });
    expect(a).not.toEqual(b);
  });
});
