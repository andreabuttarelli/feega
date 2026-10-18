import { describe, expect, it } from 'vitest';
import { measureGaps } from './measure-gaps';

const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });

describe('⌥ measures from the selection to the hovered layer', () => {
  it('side by side: the horizontal gap, drawn through the shared band', () => {
    expect(measureGaps(rect(0, 0, 100, 100), rect(150, 50, 250, 150))).toEqual([{ axis: 'x', from: 100, to: 150, at: 75 }]);
  });

  it('one above the other: the vertical gap', () => {
    expect(measureGaps(rect(0, 0, 100, 100), rect(20, 130, 80, 200))).toEqual([{ axis: 'y', from: 100, to: 130, at: 50 }]);
  });

  it('diagonal: both gaps, each from the selection centre', () => {
    expect(measureGaps(rect(0, 0, 100, 100), rect(200, 300, 260, 360))).toEqual([
      { axis: 'x', from: 100, to: 200, at: 50 },
      { axis: 'y', from: 100, to: 300, at: 50 }
    ]);
  });

  it('inside a parent: the distance to each of its edges', () => {
    expect(measureGaps(rect(10, 20, 60, 70), rect(0, 0, 100, 100))).toEqual([
      { axis: 'x', from: 0, to: 10, at: 45 },
      { axis: 'x', from: 60, to: 100, at: 45 },
      { axis: 'y', from: 0, to: 20, at: 35 },
      { axis: 'y', from: 70, to: 100, at: 35 }
    ]);
  });

  it('the hovered layer inside the selection measures the same way, reversed', () => {
    expect(measureGaps(rect(0, 0, 100, 100), rect(10, 20, 60, 70))).toEqual(measureGaps(rect(10, 20, 60, 70), rect(0, 0, 100, 100)));
  });
});
