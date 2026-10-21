import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { record, startHistory } from '$lib/motion/history';
import { marqueeIds, primaryOf, redoRoute, spanOf, toggleId, undoRoute, UndoRoute } from './frame-multi';

describe('multi-select inside a frame', () => {
  it('shift-click adds an element, and removes it when already selected', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('the last picked element is the primary one', () => {
    expect(primaryOf(['a', 'b'])).toBe('b');
    expect(primaryOf([])).toBeNull();
  });

  it('a marquee selects every element it touches', () => {
    const rects = { a: { left: 0, top: 0, width: 10, height: 10 }, b: { left: 50, top: 50, width: 10, height: 10 } };

    expect(marqueeIds(rects, spanOf([8, 8], [-5, -5]))).toEqual(['a']);
    expect(marqueeIds(rects, spanOf([-5, -5], [70, 70]))).toEqual(['a', 'b']);
  });
});

describe('undo inside a frame', () => {
  const doc = newMotionDoc(MotionFormat.Landscape);

  it('goes to the canvas when the frame has nothing to undo', () => {
    expect(undoRoute(startHistory(doc))).toBe(UndoRoute.Canvas);
    expect(undoRoute(null)).toBe(UndoRoute.Canvas);
  });

  it('undoes in the frame once it has edits, and redoes there until the future is empty', () => {
    const edited = record(startHistory(doc), { ...doc, fps: doc.fps === 30 ? 60 : 30 });

    expect(undoRoute(edited)).toBe(UndoRoute.Frame);
    expect(redoRoute(edited)).toBe(UndoRoute.Canvas);
  });
});
