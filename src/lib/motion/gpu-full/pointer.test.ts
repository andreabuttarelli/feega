import { describe, expect, it } from 'vitest';
import { Fit, contentBox, fitOf, unit } from '@feega/motion-core/motion/gpu-full/pointer';

const WIDE = { left: 0, top: 0, width: 1000, height: 500 };
const SQUARE = 1;

describe('where the video sits in its element', () => {
  it('fills the element', () => {
    expect(contentBox(WIDE, SQUARE, Fit.Fill)).toEqual(WIDE);
  });

  it('is centred and fully visible when contained', () => {
    expect(contentBox(WIDE, SQUARE, Fit.Contain)).toEqual({ left: 250, top: 0, width: 500, height: 500 });
  });

  it('overflows the short side when covering', () => {
    expect(contentBox(WIDE, SQUARE, Fit.Cover)).toEqual({ left: 0, top: -250, width: 1000, height: 1000 });
  });

  it('reads the pointer as a fraction of the video, not of the element', () => {
    const box = contentBox({ left: 100, top: 0, width: 1000, height: 500 }, SQUARE, Fit.Contain);

    expect(unit(box, 600, 250)).toEqual([0.5, 0.5]);
    expect(unit(box, 350, 0)).toEqual([0, 0]);
  });

  it('falls back to fill for a fit it does not know', () => {
    expect(fitOf('zoom')).toBe(Fit.Fill);
    expect(fitOf(null)).toBe(Fit.Fill);
    expect(fitOf('cover')).toBe(Fit.Cover);
  });
});
