import { describe, expect, it } from 'vitest';
import { ResizeCursor, resizeCursor } from './resize-cursor';

describe('resizeCursor', () => {
  it('picks the cursor from the handle direction on screen', () => {
    expect(resizeCursor([1, 0], 0)).toBe(ResizeCursor.Horizontal);
    expect(resizeCursor([0, -1], 0)).toBe(ResizeCursor.Vertical);
    expect(resizeCursor([1, 1], 0)).toBe(ResizeCursor.Falling);
    expect(resizeCursor([-1, 1], 0)).toBe(ResizeCursor.Rising);
  });

  it('turns with the element', () => {
    expect(resizeCursor([1, 0], 90)).toBe(ResizeCursor.Vertical);
    expect(resizeCursor([1, 0], 45)).toBe(ResizeCursor.Falling);
    expect(resizeCursor([1, 1], 45)).toBe(ResizeCursor.Vertical);
    expect(resizeCursor([0, 1], 30)).toBe(ResizeCursor.Rising);
  });
});
