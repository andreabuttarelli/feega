import { describe, expect, it } from 'vitest';
import { inverseResize, resizeStale, type ResizeGesture } from './resize-gesture';

const gesture: ResizeGesture = { nodeId: 'n', before: { x: 0, y: 0, w: 120, h: 80 }, after: { x: -30, y: -20, w: 150, h: 100 } };

describe('annullare un ridimensionamento', () => {
  it('il redo è lo stesso gesto, con prima e dopo scambiati', () => {
    expect(inverseResize(gesture)).toEqual({ nodeId: 'n', before: gesture.after, after: gesture.before });
  });

  it('si annulla solo se la tile è ancora dove il gesto l’ha lasciata', () => {
    expect(resizeStale(gesture, { x: -30, y: -20 })).toBe(false);
    expect(resizeStale(gesture, { x: 10, y: -20 })).toBe(true);
    expect(resizeStale(gesture, null)).toBe(true);
  });
});
