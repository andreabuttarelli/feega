import { describe, expect, it } from 'vitest';
import { chain, cssAffine, cssRgba, joinRasters, IDENTITY } from './layer-tree';

describe('chain', () => {
  it('applies the inner affine first, then the outer', () => {
    const move = chain([1, 0, 0, 1, 10, 0], [2, 0, 0, 2, 0, 0]);
    expect(move).toEqual([2, 0, 0, 2, 10, 0]);
  });
});

describe('cssAffine', () => {
  it('is the identity without a transform', () => {
    expect(cssAffine('none', '0px 0px')).toEqual(IDENTITY);
  });

  it('turns about the transform origin, not the corner', () => {
    const [a, b, c, d, e, f] = cssAffine('matrix(0, 1, -1, 0, 0, 0)', '50px 50px') as number[];
    expect([a, b, c, d]).toEqual([0, 1, -1, 0]);
    expect([e, f]).toEqual([100, 0]);
  });

  it('refuses a 3D matrix', () => {
    expect(cssAffine('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)', '0px 0px')).toBeNull();
  });
});

describe('cssRgba', () => {
  it('reads a computed colour as straight 0..1 channels', () => {
    expect(cssRgba('rgb(255, 0, 51)')).toEqual([1, 0, 0.2, 1]);
    expect(cssRgba('rgba(0, 0, 0, 0.5)')).toEqual([0, 0, 0, 0.5]);
  });

  it('has nothing to paint for a transparent colour', () => {
    expect(cssRgba('rgba(0, 0, 0, 0)')).toBeNull();
    expect(cssRgba('transparent')).toBeNull();
  });
});

describe('joinRasters', () => {
  it('rasterises neighbouring DOM-only siblings in one pass, never across a GPU layer', () => {
    const gpu = { gpu: 'x' };
    expect(joinRasters([{ raster: ['a'] }, null, { raster: ['b'] }, gpu, { raster: ['c'] }])).toEqual([{ raster: ['a', 'b'] }, gpu, { raster: ['c'] }]);
  });
});
