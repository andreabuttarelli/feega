import { describe, expect, it } from 'vitest';
import { ssim } from './ssim';

const W = 16;
const image = (pixel: (x: number, y: number) => number) => {
  const data = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const v = pixel(x, y);
      data.set([v, v, v, 255], (y * W + x) * 4);
    }
  }
  return { data, width: W, height: W };
};

describe('ssim', () => {
  it('is 1 for identical images', () => {
    const a = image((x, y) => (x * 7 + y * 13) % 256);

    expect(ssim(a, a)).toBeCloseTo(1);
  });

  it('drops for an inverted image', () => {
    const a = image((x) => (x < 8 ? 0 : 255));
    const b = image((x) => (x < 8 ? 255 : 0));

    expect(ssim(a, b)).toBeLessThan(0);
  });

  it('stays high for a one-level shift', () => {
    const a = image((x, y) => (x * 7 + y * 13) % 200);
    const b = image((x, y) => ((x * 7 + y * 13) % 200) + 1);

    expect(ssim(a, b)).toBeGreaterThan(0.99);
  });
});
