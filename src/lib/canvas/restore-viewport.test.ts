import { describe, expect, it } from 'vitest';
import { restoreViewport } from './restore-viewport';

const screen = { width: 1000, height: 800 };
const content = { x: 5000, y: 5000, width: 400, height: 300 };

describe('restoreViewport', () => {
  it('keeps the saved view when it shows part of the content', () => {
    const saved = { x: -4800, y: -4900, zoom: 1 };
    expect(restoreViewport(saved, content, screen)).toEqual(saved);
  });

  it('fits the content when the saved view shows empty space', () => {
    const view = restoreViewport({ x: 0, y: 0, zoom: 1 }, content, screen);
    const centre = { x: (5000 + 200) * view.zoom + view.x, y: (5000 + 150) * view.zoom + view.y };
    expect(centre).toEqual({ x: 500, y: 400 });
  });

  it('fits the content when nothing was saved', () => {
    const view = restoreViewport(null, content, screen);
    expect(view.zoom).toBe(1);
    expect(view.x + 5200).toBe(500);
  });

  it('never zooms past 100 percent for small content', () => {
    const view = restoreViewport(null, { x: 0, y: 0, width: 10, height: 10 }, screen);
    expect(view.zoom).toBe(1);
  });

  it('zooms out so large content fits with padding', () => {
    const view = restoreViewport(null, { x: 0, y: 0, width: 10000, height: 100 }, screen);
    expect(view.zoom).toBeCloseTo(1000 / 12000);
  });

  it('clamps the zoom to the minimum', () => {
    const view = restoreViewport(null, { x: 0, y: 0, width: 1e9, height: 10 }, screen);
    expect(view.zoom).toBe(0.05);
  });

  it('centres an empty page at the origin', () => {
    expect(restoreViewport({ x: 99, y: 99, zoom: 2 }, null, screen)).toEqual({ x: 500, y: 400, zoom: 1 });
  });

  it('ignores a corrupt saved view', () => {
    const view = restoreViewport({ x: NaN, y: 0, zoom: 0 }, content, screen);
    expect(Number.isFinite(view.x)).toBe(true);
    expect(view.zoom).toBe(1);
  });

  it('ignores a saved view that only touches the content edge', () => {
    const saved = { x: -5400, y: 0, zoom: 1 };
    expect(restoreViewport(saved, content, screen)).not.toEqual(saved);
  });
});
