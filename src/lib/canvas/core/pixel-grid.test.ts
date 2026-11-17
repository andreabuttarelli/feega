import { describe, expect, it } from 'vitest';
import { GRID_ALPHA, GRID_FADE_FROM, GRID_FULL_AT, gridAlpha, gridFade, gridStops } from './pixel-grid';

const WIDTH = 1200;

describe('canvas pixel grid', () => {
  it('is hidden below the fade start', () => {
    expect(gridFade(GRID_FADE_FROM - 0.01)).toBe(0);
    expect(gridStops(-137.3, 4, WIDTH)).toEqual([]);
    expect(gridStops(-137.3, GRID_FADE_FROM, WIDTH)).toEqual([]);
  });

  it('fades in between 600% and 800%', () => {
    expect(gridFade(7)).toBeCloseTo(0.5);
    expect(gridFade(GRID_FULL_AT)).toBe(1);
    expect(gridFade(32)).toBe(1);
    expect(gridAlpha(7)).toBeLessThan(gridAlpha(8));
    expect(gridAlpha(32)).toBe(GRID_ALPHA);
  });

  it.each([8, 16, 32])('lines sit on whole canvas pixels at %ix, one pixel apart', (zoom) => {
    const offset = -137.3;
    const stops = gridStops(offset, zoom, WIDTH);

    expect(stops.every((s) => Number.isInteger((s - offset) / zoom))).toBe(true);
    expect(stops.slice(1).every((s, i) => Math.abs(s - stops[i] - zoom) < 1e-9)).toBe(true);
    expect(stops[0]).toBeGreaterThanOrEqual(0);
    expect(stops[0]).toBeLessThan(zoom);
    expect(stops[stops.length - 1]).toBeLessThanOrEqual(WIDTH);
    expect(stops[stops.length - 1]).toBeGreaterThan(WIDTH - zoom);
  });
});
