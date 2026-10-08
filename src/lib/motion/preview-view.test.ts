import { describe, expect, it } from 'vitest';
import { FIT, ZOOM_PRESETS, fitScale, panBy, scaleOf, zoomAt, zoomLabel, zoomStep, type View } from './preview-view';

const frame = { width: 1080, height: 1920 };
const box = { width: 800, height: 600 };

describe('preview view', () => {
  it('fit shrinks the frame to the box, and grows a small one up to it', () => {
    expect(fitScale(frame, box)).toBeCloseTo(600 / 1920);
    expect(fitScale({ width: 100, height: 100 }, box)).toBe(6);
    expect(scaleOf(FIT, frame, box)).toBeCloseTo(600 / 1920);
  });

  it('zooming keeps the point under the cursor still', () => {
    const start: View = { scale: 1, x: 0, y: 0 };
    const anchor = { x: 200, y: -100 };
    const next = zoomAt(start, 2, anchor, frame, box);

    expect(next.scale).toBe(2);
    expect({ x: (anchor.x - next.x) / 2, y: (anchor.y - next.y) / 2 }).toEqual({ x: anchor.x - start.x, y: anchor.y - start.y });
  });

  it('a frame smaller than the box stays centred', () => {
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 0.1, { x: 300, y: 200 }, frame, box)).toEqual({ scale: 0.1, x: 0, y: 0 });
  });

  it('panning stops at the frame edge', () => {
    const view = panBy({ scale: 1, x: 0, y: 0 }, { x: 10_000, y: -10_000 }, frame, box);

    expect(view.x).toBe((1080 - 800) / 2);
    expect(view.y).toBe(-(1920 - 600) / 2);
  });

  it('clamps the zoom between 10% and 800%', () => {
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 100, { x: 0, y: 0 }, frame, box).scale).toBe(8);
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 0.001, { x: 0, y: 0 }, frame, box).scale).toBe(0.1);
  });

  it('steps through the presets from wherever it is, fit included', () => {
    expect(zoomStep(0.3125, 1)).toBe(0.5);
    expect(zoomStep(1, 1)).toBe(2);
    expect(zoomStep(1, -1)).toBe(0.5);
    expect(zoomStep(8, 1)).toBe(8);
    expect(ZOOM_PRESETS).toEqual([0.1, 0.25, 0.5, 1, 2, 4, 8]);
  });

  it('labels fit and percentages', () => {
    expect(zoomLabel(FIT, 0.3125)).toBe('Fit');
    expect(zoomLabel({ scale: 2, x: 0, y: 0 }, 2)).toBe('200%');
  });

  it('a view is only scale and offset: zooming never reaches the document', () => {
    expect(Object.keys(zoomAt(FIT, 2, { x: 0, y: 0 }, frame, box)).sort()).toEqual(['scale', 'x', 'y']);
  });
});
