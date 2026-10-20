import { describe, expect, it } from 'vitest';
import { TextSizing, fittedTextBox, sizingAfterResize } from './text-sizing';

const doc = { width: 1000, height: 500 };
const placed = { x: 0.5, y: 0.5, width: 0.2, height: 0.2 };

describe('a text box that follows its text', () => {
  it('auto width takes the measured width and height, keeping its top-left where it was', () => {
    const next = fittedTextBox(TextSizing.AutoWidth, placed, { left: 400, top: 200, width: 300, height: 50 }, doc);
    expect(next).toEqual({ x: 0.55, y: 0.45, width: 0.3, height: 0.1 });
  });

  it('auto height keeps its width and takes the measured height', () => {
    const next = fittedTextBox(TextSizing.AutoHeight, placed, { left: 400, top: 200, width: 200, height: 150 }, doc);
    expect(next).toEqual({ x: 0.5, y: 0.55, width: 0.2, height: 0.3 });
  });

  it('never grows past the stage, so the doc stays valid', () => {
    const next = fittedTextBox(TextSizing.AutoHeight, { x: 0.5, y: 0.5, width: 0.2, height: 0.2 }, { left: 400, top: 200, width: 200, height: 900 }, doc)!;
    expect(next.height).toBeLessThanOrEqual(1);
    expect(next.y).toBeLessThanOrEqual(1);
    expect(next.y - next.height / 2).toBeGreaterThanOrEqual(0);
  });

  it('a fixed box never moves on its own', () => {
    expect(fittedTextBox(TextSizing.Fixed, placed, { left: 0, top: 0, width: 10, height: 10 }, doc)).toBeNull();
  });

  it('a box that already fits is left alone, so a redraw does not loop', () => {
    expect(fittedTextBox(TextSizing.AutoWidth, placed, { left: 400, top: 200, width: 200.2, height: 99.8 }, doc)).toBeNull();
  });
});

describe('resizing a text by hand', () => {
  it('a new height makes it fixed', () => {
    expect(sizingAfterResize(TextSizing.AutoHeight, { width: false, height: true })).toBe(TextSizing.Fixed);
    expect(sizingAfterResize(TextSizing.AutoWidth, { width: true, height: true })).toBe(TextSizing.Fixed);
  });

  it('only a new width turns auto width into auto height', () => {
    expect(sizingAfterResize(TextSizing.AutoWidth, { width: true, height: false })).toBe(TextSizing.AutoHeight);
  });

  it('a width change keeps auto height and fixed as they are', () => {
    expect(sizingAfterResize(TextSizing.AutoHeight, { width: true, height: false })).toBe(TextSizing.AutoHeight);
    expect(sizingAfterResize(TextSizing.Fixed, { width: true, height: false })).toBe(TextSizing.Fixed);
  });
});
