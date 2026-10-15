import { describe, expect, it } from 'vitest';
import { closedHover, containFit } from './frame-hover';

const BOXES = {
  bg: { left: 0, top: 0, width: 1, height: 1 },
  title: { left: 0.1, top: 0.1, width: 0.5, height: 0.2 },
  'title#lines:0': { left: 0.1, top: 0.1, width: 0.5, height: 0.1 }
};

describe('hover on a closed frame', () => {
  it('outlines the child under the pointer, the smallest that holds it', () => {
    expect(closedHover(BOXES, { x: 0.2, y: 0.15 })).toBe('title');
    expect(closedHover(BOXES, { x: 0.9, y: 0.9 })).toBe('bg');
  });

  it('outlines nothing outside every child', () => {
    expect(closedHover({ title: BOXES.title }, { x: 0.9, y: 0.9 })).toBeNull();
  });
});

describe('the picture inside a frame stage', () => {
  it('is centred and fitted to the frame aspect', () => {
    expect(containFit({ width: 200, height: 100 }, { width: 100, height: 100 })).toEqual({ left: 50, top: 0, width: 100, height: 100 });
    expect(containFit({ width: 100, height: 300 }, { width: 100, height: 100 })).toEqual({ left: 0, top: 100, width: 100, height: 100 });
  });
});
