import { describe, expect, it } from 'vitest';
import { gaussianKernel, MAX_TAPS } from './kernel';
import { rgbaOf } from './rgba';

describe('gaussianKernel', () => {
  it('sums to one so a blur keeps the layer brightness', () => {
    const { weights } = gaussianKernel(6);

    expect(weights[0] + 2 * weights.slice(1).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it('reaches three deviations, strided once that needs more taps than a shader holds', () => {
    expect(gaussianKernel(4)).toMatchObject({ step: 1 });
    expect(gaussianKernel(4).weights).toHaveLength(13);
    expect(gaussianKernel(200).weights.length).toBeLessThanOrEqual(MAX_TAPS);
    expect(gaussianKernel(200).step).toBeGreaterThan(1);
  });
});

describe('rgbaOf', () => {
  it('reads the colour notations the doc stores', () => {
    expect(rgbaOf('#ff000080')).toEqual([1, 0, 0, 128 / 255]);
    expect(rgbaOf('#fff')).toEqual([1, 1, 1, 1]);
    expect(rgbaOf('rgba(255, 0, 0, 0.5)')).toEqual([1, 0, 0, 0.5]);
    expect(rgbaOf('transparent')).toEqual([0, 0, 0, 0]);
    expect(rgbaOf('var(--x)')).toBeNull();
  });
});
