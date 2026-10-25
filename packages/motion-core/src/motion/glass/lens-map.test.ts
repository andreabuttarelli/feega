import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { LENS_MAP_SIZE, lensMapPng, lensMapUrl, lensPixel } from './lens-map';
import { MAGNIFY } from './model';

const EDGE = 2 / LENS_MAP_SIZE;

describe('the lens displacement map', () => {
  it('leaves the centre in place and pulls the inside toward it, so what is under the drop looks bigger', () => {
    expect(lensPixel(0, 0, EDGE)).toMatchObject({ r: 0.5, g: 0.5, a: 1 });
    expect(lensPixel(0.4, 0, EDGE).r).toBeLessThan(0.5);
    expect(lensPixel(0, -0.4, EDGE).g).toBeGreaterThan(0.5);
    expect(MAGNIFY).toBeGreaterThan(1);
  });

  it('reaches outward at the rim, where a drop bends the most', () => {
    const rim = lensPixel(0.98, 0, EDGE);

    expect(rim.r).toBeGreaterThan(0.85);
    expect(rim.g).toBe(0.5);
  });

  it('is transparent outside the drop, so nothing outside is touched', () => {
    expect(lensPixel(0.8, 0.8, EDGE).a).toBe(0);
  });

  it('is a valid PNG of the declared size, inlined as a data URL', () => {
    const png = lensMapPng(8);
    const view = new DataView(png.buffer);
    const idat = png.subarray(41, 41 + view.getUint32(33));

    expect([...png.subarray(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG');
    expect(view.getUint32(16)).toBe(8);
    expect(inflateSync(idat).length).toBe(8 * (8 * 4 + 1));
    expect(lensMapUrl()).toMatch(/^data:image\/png;base64,/);
  });
});
