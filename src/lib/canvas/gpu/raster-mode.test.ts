import { describe, expect, it } from 'vitest';
import { RasterMode } from '@feega/motion-core/motion/gpu-full/core-web';
import { rasterMode } from './raster-mode';

describe('rasterMode', () => {
  it('keeps the retained renderer unless the tiles flag is on', () => {
    expect(rasterMode('')).toBe(RasterMode.Retained);
    expect(rasterMode('?tiles=0')).toBe(RasterMode.Retained);
    expect(rasterMode('?x=1&tiles=1')).toBe(RasterMode.Tiles);
  });
});
