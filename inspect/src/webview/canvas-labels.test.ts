import { describe, expect, it } from 'vitest';
import { ROW_HEAD } from './canvas-layout';
import { labelMetrics } from './canvas-labels';
import { CANVAS_MAX_ZOOM, CANVAS_MIN_ZOOM } from './canvas-view';

const SCALES = [CANVAS_MIN_ZOOM, 0.03, 0.05, 0.1, 0.25, 0.5, 1, 2, CANVAS_MAX_ZOOM];

describe('labelMetrics', () => {
  it('keeps the route label above the size label at every zoom', () => {
    for (const scale of SCALES) {
      const { routeBottom, sizeTop } = labelMetrics(scale, ROW_HEAD);

      expect(routeBottom, `zoom ${scale}`).toBeLessThanOrEqual(sizeTop);
    }
  });

  it('keeps the size label below the row top', () => {
    for (const scale of SCALES) {
      expect(labelMetrics(scale, ROW_HEAD).sizeTop, `zoom ${scale}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('draws labels at 12 screen pixels while zoomed in', () => {
    expect(labelMetrics(1, ROW_HEAD).font).toBe(12);
    expect(labelMetrics(2, ROW_HEAD).font).toBe(6);
  });

  it('stops growing when zoomed far out', () => {
    expect(labelMetrics(CANVAS_MIN_ZOOM, ROW_HEAD).font).toBe(labelMetrics(0.01, ROW_HEAD).font);
  });
});
