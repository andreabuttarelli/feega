import { describe, expect, it } from 'vitest';
import { KEY_STEP, moveByKey, sliderPercent } from './compare-slider';

describe('sliderPercent', () => {
  const rect = { left: 100, width: 400 };

  it('maps the pointer inside the image to a percentage', () => {
    expect(sliderPercent(300, rect)).toBe(50);
    expect(sliderPercent(100, rect)).toBe(0);
  });

  it('clamps outside the image', () => {
    expect(sliderPercent(0, rect)).toBe(0);
    expect(sliderPercent(900, rect)).toBe(100);
  });

  it('is centred on an empty box', () => {
    expect(sliderPercent(10, { left: 0, width: 0 })).toBe(50);
  });
});

describe('moveByKey', () => {
  it('steps with the arrows and stays in range', () => {
    expect(moveByKey(50, 'ArrowRight')).toBe(50 + KEY_STEP);
    expect(moveByKey(2, 'ArrowLeft')).toBe(0);
    expect(moveByKey(99, 'ArrowRight')).toBe(100);
  });

  it('ignores other keys', () => {
    expect(moveByKey(50, 'a')).toBe(50);
  });
});
