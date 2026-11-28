import { describe, expect, it } from 'vitest';
import { FRAME_LIMITS, Handle, afterEscape, clampSize, presetSize, resizeBy, typedSize } from './canvas-select';
import { Size } from './sizes';

const start = { width: 400, height: 300 };

describe('resizeBy', () => {
  it('grows from the bottom-right corner with the drag', () => {
    expect(resizeBy(start, Handle.SouthEast, { x: 50, y: 20 }, 1, FRAME_LIMITS)).toEqual({ width: 450, height: 320 });
  });

  it('grows from the top-left corner when dragged up and left', () => {
    expect(resizeBy(start, Handle.NorthWest, { x: -50, y: -20 }, 1, FRAME_LIMITS)).toEqual({ width: 450, height: 320 });
  });

  it('changes only the width from a side handle', () => {
    expect(resizeBy(start, Handle.East, { x: 80, y: 500 }, 1, FRAME_LIMITS)).toEqual({ width: 480, height: 300 });
    expect(resizeBy(start, Handle.West, { x: 80, y: 500 }, 1, FRAME_LIMITS)).toEqual({ width: 320, height: 300 });
  });

  it('changes only the height from a top or bottom handle', () => {
    expect(resizeBy(start, Handle.South, { x: 500, y: 40 }, 1, FRAME_LIMITS)).toEqual({ width: 400, height: 340 });
    expect(resizeBy(start, Handle.North, { x: 500, y: 40 }, 1, FRAME_LIMITS)).toEqual({ width: 400, height: 260 });
  });

  it('converts screen pixels to canvas units by the zoom', () => {
    expect(resizeBy(start, Handle.SouthEast, { x: 100, y: 50 }, 0.5, FRAME_LIMITS)).toEqual({ width: 600, height: 400 });
  });

  it('stops at the limits', () => {
    expect(resizeBy(start, Handle.SouthEast, { x: -9999, y: -9999 }, 1, FRAME_LIMITS)).toEqual(FRAME_LIMITS.min);
    expect(resizeBy(start, Handle.SouthEast, { x: 99999, y: 99999 }, 1, FRAME_LIMITS)).toEqual(FRAME_LIMITS.max);
  });

  it('rounds to whole canvas units', () => {
    expect(resizeBy(start, Handle.SouthEast, { x: 10.4, y: 10.6 }, 1, FRAME_LIMITS)).toEqual({ width: 410, height: 311 });
  });
});

describe('typedSize', () => {
  it('replaces one side with the typed number', () => {
    expect(typedSize(start, 'width', '512', FRAME_LIMITS)).toEqual({ width: 512, height: 300 });
    expect(typedSize(start, 'height', '700', FRAME_LIMITS)).toEqual({ width: 400, height: 700 });
  });

  it('clamps a typed number to the limits', () => {
    expect(typedSize(start, 'width', '1', FRAME_LIMITS)?.width).toBe(FRAME_LIMITS.min.width);
  });

  it('ignores text that is not a number', () => {
    expect(typedSize(start, 'width', 'wide', FRAME_LIMITS)).toBeNull();
    expect(typedSize(start, 'width', '', FRAME_LIMITS)).toBeNull();
  });
});

describe('presetSize', () => {
  it('takes the width and height of a device preset', () => {
    expect(presetSize(Size.Phone)).toEqual({ width: 390, height: 844 });
  });

  it('has none for a size without dimensions', () => {
    expect(presetSize(Size.Full)).toBeNull();
    expect(presetSize(Size.Custom)).toBeNull();
  });
});

describe('clampSize', () => {
  it('keeps a size inside the limits', () => {
    expect(clampSize({ width: 0, height: 99999 }, FRAME_LIMITS)).toEqual({ width: FRAME_LIMITS.min.width, height: FRAME_LIMITS.max.height });
  });
});

describe('afterEscape', () => {
  it('deselects before it closes the canvas', () => {
    expect(afterEscape('a')).toEqual({ selected: null, close: false });
  });

  it('closes the canvas when nothing is selected', () => {
    expect(afterEscape(null)).toEqual({ selected: null, close: true });
  });
});
