import { describe, expect, it } from 'vitest';
import { hexOf, paintOf } from './colour';

describe('paintOf', () => {
  it('a transparent background is no paint, not black', () => {
    expect(paintOf('rgba(0, 0, 0, 0)')).toBeNull();
    expect(paintOf('transparent')).toBeNull();
  });

  it('white text is white', () => {
    expect(paintOf('rgb(255, 255, 255)')).toBe('#ffffff');
  });

  it('a half transparent colour keeps its hex', () => {
    expect(paintOf('rgba(0, 120, 212, 0.5)')).toBe('#0078d4');
  });

  it('hexOf still turns rgb into hex', () => {
    expect(hexOf('rgb(0, 120, 212)')).toBe('#0078d4');
  });
});
