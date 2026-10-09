import { describe, expect, it } from 'vitest';
import { FIT_SCALE, Fit, fitBox } from './fit';

const landscape = { width: 1920, height: 1080 };
const portraitBox = { width: 600, height: 800 };

describe('fitting the video into the space the host gives it', () => {
  it('cover fills the box and crops the overflow, centred', () => {
    const box = fitBox(portraitBox, landscape, Math[FIT_SCALE[Fit.Cover]]);

    expect(box.height).toBeCloseTo(800);
    expect(box.width).toBeCloseTo(1422.22, 1);
    expect(box.left).toBeCloseTo((600 - 1422.22) / 2, 1);
    expect(box.top).toBe(0);
  });

  it('contain shows all of it, centred, with bars', () => {
    const box = fitBox(portraitBox, landscape, Math[FIT_SCALE[Fit.Contain]]);

    expect(box.width).toBe(600);
    expect(box.height).toBeCloseTo(337.5);
    expect(box.top).toBeCloseTo((800 - 337.5) / 2);
  });

  it('a box of the video own ratio is filled exactly either way', () => {
    const exact = { width: 960, height: 540 };
    expect(fitBox(exact, landscape, Math.max)).toEqual({ left: 0, top: 0, width: 960, height: 540 });
    expect(fitBox(exact, landscape, Math.min)).toEqual({ left: 0, top: 0, width: 960, height: 540 });
  });
});
