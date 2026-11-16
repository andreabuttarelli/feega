import { describe, expect, it } from 'vitest';
import { fitResolution, MAX_TARGET_SIDE, OVERSCAN_MAX, overscanOf } from './surface-fit';

const targetsOf = (area: { width: number; height: number }, resolution: number) => {
  const surface = { width: Math.round(area.width * resolution), height: Math.round(area.height * resolution) };
  const overscan = overscanOf(area, resolution);
  return [surface, { width: surface.width + 2 * overscan, height: surface.height + 2 * overscan }];
};

describe('fitResolution', () => {
  it('keeps the device ratio when the surface fits', () => {
    expect(fitResolution({ width: 1440, height: 900 }, 2, 2)).toBe(2);
  });

  it('lowers the ratio so a wide window at DPR 2 fits every render target', () => {
    const area = { width: 2200, height: 1100 };
    const resolution = fitResolution(area, 2, 2);

    expect(resolution).toBeLessThan(2);
    for (const target of targetsOf(area, resolution)) {
      expect(Math.max(target.width, target.height)).toBeLessThanOrEqual(MAX_TARGET_SIDE);
    }
  });

  it('never makes a render target past the limit, at any window size', () => {
    for (const width of [800, 1920, 2158, 2560, 3440, 5120]) {
      for (const dpr of [1, 1.5, 2, 3]) {
        const area = { width, height: width / 2 };
        for (const target of targetsOf(area, fitResolution(area, dpr, dpr))) {
          expect(Math.max(target.width, target.height)).toBeLessThanOrEqual(MAX_TARGET_SIDE);
        }
      }
    }
  });

  it('caps the overscan', () => {
    expect(overscanOf({ width: 5000, height: 5000 }, 2)).toBe(OVERSCAN_MAX);
  });
});
