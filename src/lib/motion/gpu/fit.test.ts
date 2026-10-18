import { describe, expect, it } from 'vitest';
import { fitRect, logoRect } from './fit';

const BOX = { width: 200, height: 100 };
const SQUARE = { width: 50, height: 50 };

describe('fitRect', () => {
  it('covers the box and centres the overflow on the focus', () => {
    expect(fitRect('cover', BOX, SQUARE, [0.5, 0.5])).toEqual([0, -50, 200, 200]);
    expect(fitRect('cover', BOX, SQUARE, [0.5, 0])).toEqual([0, 0, 200, 200]);
  });

  it('contains the picture inside the box', () => {
    expect(fitRect('contain', BOX, SQUARE, [0.5, 0.5])).toEqual([50, 0, 100, 100]);
  });

  it('stretches on fill', () => {
    expect(fitRect('fill', BOX, SQUARE, [0.5, 0.5])).toEqual([0, 0, 200, 100]);
  });
});

describe('logoRect', () => {
  it('spans the box width at the picture aspect, centred vertically', () => {
    expect(logoRect(BOX, { width: 100, height: 25 })).toEqual([0, 25, 200, 50]);
  });
});
