import { describe, expect, it } from 'vitest';
import { fractionOf, pxOf, textFace, textMetrics } from './type-px';

describe('type px', () => {
  it('converts a frame fraction to px and back on the short side', () => {
    expect(pxOf(0.0364, 1080)).toBe(39);
    expect(fractionOf(39, 1080)).toBeCloseTo(0.0361, 4);
  });

  it('describes a text style in px with leading as a ratio', () => {
    const look = { font: 'Manrope', weight: 500, size: 0.0364, leading: 1 };
    expect(textFace(look)).toBe('Manrope 500');
    expect(textMetrics(look, 1080)).toBe('39 px / 1');
    expect(textFace({}) + textMetrics({}, 1080)).toBe('');
  });
});
