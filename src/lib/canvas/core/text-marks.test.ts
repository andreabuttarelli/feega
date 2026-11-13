import { describe, expect, it } from 'vitest';
import type { CaretLine } from '@feega/motion-core/motion/gpu-full/text/caret';
import { editMarks } from './text-marks';

const LINES: CaretLine[] = [
  { start: 0, end: 3, shown: 3, top: 0, height: 20, ink: 2, inkHeight: 16, stops: [{ offset: 0, x: 10 }, { offset: 1, x: 20 }, { offset: 2, x: 30 }, { offset: 3, x: 40 }] },
  { start: 3, end: 5, shown: 5, top: 20, height: 20, ink: 22, inkHeight: 16, stops: [{ offset: 3, x: 5 }, { offset: 4, x: 15 }, { offset: 5, x: 25 }] }
];

describe('caret and selection drawn from the engine layout', () => {
  it('puts the caret on the glyph edge the engine laid out', () => {
    expect(editMarks(LINES, 'abcde', { start: 1, end: 1 }, 2)).toEqual({ caret: { left: 19, top: 2, width: 2, height: 16 }, boxes: [] });
  });

  it('spans a selection across the engine lines it crosses', () => {
    expect(editMarks(LINES, 'abcde', { start: 1, end: 4 }, 2)).toEqual({
      caret: null,
      boxes: [
        { left: 20, top: 2, width: 20, height: 16 },
        { left: 5, top: 22, width: 10, height: 16 }
      ]
    });
  });

  it('counts an emoji as one engine position', () => {
    expect(editMarks(LINES, '😀bcde', { start: 2, end: 2 }, 2).caret?.left).toBe(19);
  });

  it('draws nothing before the engine has laid the text', () => {
    expect(editMarks([], 'abc', { start: 0, end: 0 }, 2)).toEqual({ caret: null, boxes: [] });
  });
});
