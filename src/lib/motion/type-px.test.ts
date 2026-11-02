import { describe, expect, it } from 'vitest';
import { fractionOf, pxOf, textMeta } from './type-px';

describe('type px', () => {
  it('converts a frame fraction to px and back on the short side', () => {
    expect(pxOf(0.0364, 1080)).toBe(39);
    expect(fractionOf(39, 1080)).toBeCloseTo(0.0361, 4);
  });

  it('describes a text style in px with leading as a ratio', () => {
    expect(textMeta({ font: 'Manrope', weight: 500, size: 0.0364, leading: 1 }, 1080)).toBe('Manrope 500 · 39 px / 1');
    expect(textMeta({}, 1080)).toBe('');
  });
});
