import { describe, expect, it } from 'vitest';
import { ResizeCursor, resizeCursor, rotateCursor } from './resize-cursor';

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

const turnOf = (cursor: string) => Number(/rotate\((-?[\d.]+)/.exec(decodeURIComponent(cursor))?.[1]);

describe('rotateCursor', () => {
  it('points outward from each corner', () => {
    expect(turnOf(rotateCursor([-1, -1], 0))).toBe(0);
    expect(turnOf(rotateCursor([1, -1], 0))).toBe(90);
    expect(turnOf(rotateCursor([1, 1], 0))).toBe(180);
    expect(turnOf(rotateCursor([-1, 1], 0))).toBe(270);
  });

  it('follows the rotation of the object', () => {
    expect(turnOf(rotateCursor([-1, -1], 30))).toBe(30);
    expect(turnOf(rotateCursor([1, 1], 200))).toBe(20);
  });

  it('is a url cursor with a fallback', () => {
    expect(rotateCursor([1, 1], 0)).toMatch(/^url\("data:image\/svg\+xml,.+"\) 12 12, grab$/);
  });
});
