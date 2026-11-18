import { describe, expect, it } from 'vitest';
import { GuideAxis } from './user-guides';
import { addCanvasGuide, moveCanvasGuide, pullToGuides, removeCanvasGuide, rulerMarks } from './canvas-rulers';

describe('canvas rulers', () => {
  it('labels marks in canvas units and places them with the camera', () => {
    const marks = rulerMarks(-137.3, 2, 400);

    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((m) => Math.abs(m.screen - (-137.3 + Number(m.label) * 2)) < 1e-9)).toBe(true);
    expect(marks.every((m) => m.screen >= 0 && m.screen <= 400)).toBe(true);
  });

  it('marks stay at least a label apart whatever the zoom', () => {
    for (const zoom of [0.05, 0.3, 1, 4, 32]) {
      const marks = rulerMarks(10, zoom, 1000);

      expect(marks.slice(1).every((m, i) => m.screen - marks[i].screen >= 40 - 1e-9)).toBe(true);
    }
  });

  it('negative canvas coordinates get marks too', () => {
    const marks = rulerMarks(500, 1, 400);

    expect(marks.some((m) => Number(m.label) < 0)).toBe(true);
  });
});

describe('canvas guides', () => {
  it('adds, moves and removes a guide', () => {
    const one = addCanvasGuide([], { axis: GuideAxis.Vertical, at: 120.4 });
    const moved = moveCanvasGuide(one, one[0], 300);

    expect(one).toEqual([{ axis: 'x', at: 120 }]);
    expect(moved).toEqual([{ axis: 'x', at: 300 }]);
    expect(removeCanvasGuide(moved, moved[0])).toEqual([]);
  });

  it('the same guide twice stays one', () => {
    const once = addCanvasGuide([], { axis: GuideAxis.Horizontal, at: 50 });

    expect(addCanvasGuide(once, { axis: GuideAxis.Horizontal, at: 50 })).toHaveLength(1);
  });
});

describe('pulling a box to guides', () => {
  const guides = [
    { axis: GuideAxis.Vertical, at: 200 },
    { axis: GuideAxis.Horizontal, at: 100 }
  ];

  it('pulls the nearest edge of the box onto a guide inside reach', () => {
    expect(pullToGuides({ x: 96, y: 40, w: 100, h: 50 }, guides, 6)).toEqual({ dx: 4, dy: 0 });
    expect(pullToGuides({ x: 30, y: 53, w: 80, h: 44 }, guides, 6)).toEqual({ dx: 0, dy: 3 });
  });

  it('pulls the centre too', () => {
    expect(pullToGuides({ x: 152, y: 0, w: 100, h: 10 }, guides, 6)).toEqual({ dx: -2, dy: 0 });
  });

  it('leaves the box alone out of reach', () => {
    expect(pullToGuides({ x: 0, y: 0, w: 50, h: 50 }, guides, 6)).toEqual({ dx: 0, dy: 0 });
  });
});
