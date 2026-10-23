import { describe, expect, it } from 'vitest';
import { MAX_TILES, tileCells } from './image-tile';

const box = { width: 200, height: 100 };
const square = { width: 100, height: 100 };

describe('tiling a picture across a box', () => {
  it('lays cells a quarter of the box wide per unit of scale, placed by focus', () => {
    const cells = tileCells(box, square, { scale: 2, rotation: 0, focus: [0.5, 0.5] });
    expect(cells).toEqual([
      { x: -50, y: 0, width: 100, height: 100 },
      { x: 50, y: 0, width: 100, height: 100 },
      { x: 150, y: 0, width: 100, height: 100 }
    ]);
  });

  it('keeps the picture ratio', () => {
    const [cell] = tileCells(box, { width: 100, height: 50 }, { scale: 2, rotation: 0, focus: [0, 0] });
    expect(cell).toMatchObject({ width: 100, height: 50 });
  });

  it('reaches the corners of a rotated box', () => {
    const spun = tileCells(box, square, { scale: 2, rotation: 45, focus: [0.5, 0.5] });
    const flat = tileCells(box, square, { scale: 2, rotation: 0, focus: [0.5, 0.5] });
    expect(spun.length).toBeGreaterThan(flat.length);
  });

  it('never asks for more cells than the limit', () => {
    const sliver = tileCells({ width: 1000, height: 1000 }, { width: 1000, height: 1 }, { scale: 0.1, rotation: 0, focus: [0.5, 0.5] });
    expect(sliver.length).toBe(MAX_TILES);
  });
});
