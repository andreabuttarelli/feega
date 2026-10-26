import { describe, expect, it } from 'vitest';
import { BRUSH_MAX_PX, BRUSH_MIN_PX, brushOf, maskOfStrokes, pointOf, thinned } from './brush';

const RECT = { left: 100, top: 50, width: 400, height: 200 };

describe('pointOf', () => {
  it('turns a screen point into a fraction of the picture', () => {
    expect(pointOf({ x: 300, y: 150 }, RECT)).toEqual([0.5, 0.5]);
  });

  it('keeps a point dragged past the edge on the edge', () => {
    expect(pointOf({ x: 90, y: 400 }, RECT)).toEqual([0, 1]);
  });
});

describe('brushOf', () => {
  it('measures the brush against the shorter side, like the server does', () => {
    expect(brushOf(20, RECT)).toBeCloseTo(0.1, 6);
  });

  it('stays inside the sizes the slider offers', () => {
    expect(brushOf(BRUSH_MIN_PX - 5, RECT)).toBeCloseTo(BRUSH_MIN_PX / 200, 6);
    expect(brushOf(BRUSH_MAX_PX + 50, RECT)).toBeCloseTo(BRUSH_MAX_PX / 200, 6);
  });
});

describe('thinned', () => {
  it('drops points that are almost on top of the previous one, keeping the last', () => {
    const points: [number, number][] = [[0, 0], [0.0001, 0], [0.0002, 0], [0.5, 0.5], [0.5001, 0.5]];

    expect(thinned(points)).toEqual([[0, 0], [0.5, 0.5], [0.5001, 0.5]]);
  });

  it('never leaves a stroke empty', () => {
    expect(thinned([[0.2, 0.2]])).toEqual([[0.2, 0.2]]);
  });
});

describe('maskOfStrokes', () => {
  it('is nothing until something is painted', () => {
    expect(maskOfStrokes([])).toBeNull();
  });

  it('wraps the strokes for the server', () => {
    const strokes = [{ points: [[0.1, 0.1]] as [number, number][], width: 0.1 }];

    expect(maskOfStrokes(strokes)).toEqual({ strokes });
  });
});
