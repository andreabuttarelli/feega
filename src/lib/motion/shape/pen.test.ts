import { describe, expect, it } from 'vitest';
import { parsePath, pathData, type Outline } from './geometry';
import { Handle, Mirror, addPoint, deletePoint, dragHandle, movePoint, toggleClosed } from './pen';

const read = (d: string): Outline => {
  const o = parsePath(d);
  if (typeof o === 'string') {
    throw new Error(o);
  }
  return o;
};

describe('pen tool', () => {
  it('a click appends a point to the open contour, or starts one when every contour is closed', () => {
    expect(pathData(addPoint(read('M0 0L1 0'), [1, 1]))).toBe('M0 0L1 0L1 1');
    expect(pathData(addPoint(read('M0 0L1 0L1 1Z'), [0.5, 0.5]))).toBe('M0 0L1 0L1 1ZM0.5 0.5');
    expect(pathData(addPoint([], [0.2, 0.2]))).toBe('M0.2 0.2');
  });

  it('moving a point carries its handles with it', () => {
    const moved = movePoint(read('M0 0C0.2 0 0.8 1 1 1'), { contour: 0, index: 1 }, [0.1, 0]);
    expect(pathData(moved)).toBe('M0 0C0.2 0 0.9 1 1.1 1');
  });

  it('dragging a handle mirrors the other one unless broken', () => {
    const start = read('M0 0L0.5 0.5L1 0');
    const smooth = dragHandle(start, { contour: 0, index: 1 }, Handle.Out, [0.7, 0.5], Mirror.Mirrored);
    expect(smooth[0].vertices[1].in).toEqual([0.3, 0.5]);
    const broken = dragHandle(start, { contour: 0, index: 1 }, Handle.Out, [0.7, 0.5], Mirror.Broken);
    expect(broken[0].vertices[1].in).toEqual([0.5, 0.5]);
  });

  it('deleting a point drops it, and drops the contour once it is empty', () => {
    expect(pathData(deletePoint(read('M0 0L1 0L1 1Z'), { contour: 0, index: 1 }))).toBe('M0 0L1 1Z');
    expect(deletePoint(read('M0 0'), { contour: 0, index: 0 })).toEqual([]);
  });

  it('a contour closes and opens', () => {
    expect(pathData(toggleClosed(read('M0 0L1 0L1 1'), 0))).toBe('M0 0L1 0L1 1Z');
    expect(pathData(toggleClosed(read('M0 0L1 0L1 1Z'), 0))).toBe('M0 0L1 0L1 1');
  });
});
