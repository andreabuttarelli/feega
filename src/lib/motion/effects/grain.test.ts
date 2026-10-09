import { describe, expect, it } from 'vitest';
import { grainPixels, type GrainArea } from './grain';

const TILE = 2;
const tile = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
const identity = (width: number, height: number): GrainArea => ({ inverse: [1, 0, 0, 1, 0, 0], width, height, margin: 0 });
const solid = (width: number, height: number, rgba: number[]) => new Uint8ClampedArray(Array.from({ length: width * height }, () => rgba).flat());

describe('grainPixels', () => {
  it('schiarisce dove la grana è bianca e scurisce dove è nera, di amount/2', () => {
    const out = grainPixels(solid(2, 1, [100, 100, 100, 255]), 2, 1, [{ amount: 0.4, tile, tileSize: TILE }], identity(2, 1));
    expect(Array.from(out.slice(0, 4))).toEqual([151, 151, 151, 255]);
    expect(Array.from(out.slice(4, 8))).toEqual([49, 49, 49, 255]);
  });

  it('lascia trasparente ciò che era trasparente', () => {
    const out = grainPixels(solid(2, 2, [0, 0, 0, 0]), 2, 2, [{ amount: 0.4, tile, tileSize: TILE }], identity(2, 2));
    expect(out.every((v) => v === 0)).toBe(true);
  });

  it('taglia fuori dalla regione del filtro', () => {
    const out = grainPixels(solid(4, 1, [100, 100, 100, 255]), 4, 1, [{ amount: 0, tile, tileSize: TILE }], { ...identity(2, 1), margin: 0.5 });
    expect(Array.from(out.slice(0, 12))).toEqual([100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255]);
    expect(Array.from(out.slice(12, 16))).toEqual([0, 0, 0, 0]);
  });
});
