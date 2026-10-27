import type { Luma } from './luma';

export const SQUARE_SIZE = 24;

const BACKGROUND_CELL = 7;
const SQUARE_CELL = 4;
const BACKGROUND_LEVEL = { base: 90, range: 60 };
const SQUARE_LEVEL = { base: 40, range: 200 };
const SQUARE_SEED = 7;

const corner = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed + 1, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const lattice = (x: number, y: number, cell: number, seed: number): number => {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const top = corner(gx, gy, seed) * (1 - fx) + corner(gx + 1, gy, seed) * fx;
  const bottom = corner(gx, gy + 1, seed) * (1 - fx) + corner(gx + 1, gy + 1, seed) * fx;
  return top * (1 - fy) + bottom * fy;
};

export const movingSquare = (width: number, height: number, left: number, top: number, seed = 0): Luma => {
  const data = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= left && x < left + SQUARE_SIZE && y >= top && y < top + SQUARE_SIZE;
      const value = inside ? SQUARE_LEVEL.base + SQUARE_LEVEL.range * lattice(x - left, y - top, SQUARE_CELL, SQUARE_SEED) : BACKGROUND_LEVEL.base + BACKGROUND_LEVEL.range * lattice(x, y, BACKGROUND_CELL, seed);
      data[y * width + x] = Math.round(value);
    }
  }
  return { width, height, data };
};
