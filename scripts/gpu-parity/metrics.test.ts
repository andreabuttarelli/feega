import { describe, expect, it } from 'vitest';
import { luma, psnr, ssim } from './metrics';

const W = 32;
const H = 32;

const gradient = (shift = 0) => {
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = ((i % W) * 8 + shift) % 256;
    rgba.set([v, v, v, 255], i * 4);
  }
  return luma(rgba);
};

describe('frame metrics', () => {
  it('scores identical frames as identical', () => {
    expect(ssim(gradient(), gradient(), W, H)).toBeCloseTo(1);
    expect(psnr(gradient(), gradient())).toBe(Number.POSITIVE_INFINITY);
  });

  it('scores a shifted frame lower than an identical one', () => {
    expect(ssim(gradient(), gradient(64), W, H)).toBeLessThan(0.9);
    expect(psnr(gradient(), gradient(64))).toBeLessThan(20);
  });
});
