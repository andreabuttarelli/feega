export enum DiffMode {
  Overlay = 'overlay',
  Slider = 'slider'
}

export type Pixels = { width: number; height: number; data: Uint8ClampedArray };

export type Region = { x: number; y: number; w: number; h: number };

export type DiffOptions = { cell?: number; threshold?: number };

const DEFAULT_CELL = 16;
const DEFAULT_THRESHOLD = 24;
const RGB = 3;
const PROBE = 8;
const RGBA = 4;
const WHOLE: Region = { x: 0, y: 0, w: 1, h: 1 };

function blockMean(p: Pixels, left: number, top: number, size: number, channel: number): number {
  let sum = 0;
  let count = 0;
  for (let y = top; y < Math.min(p.height, top + size); y++) {
    for (let x = left; x < Math.min(p.width, left + size); x++) {
      sum += p.data[(y * p.width + x) * RGBA + channel];
      count++;
    }
  }
  return sum / count;
}

function blockChanged(a: Pixels, b: Pixels, left: number, top: number, size: number, threshold: number): boolean {
  for (let c = 0; c < RGB; c++) {
    if (Math.abs(blockMean(a, left, top, size, c) - blockMean(b, left, top, size, c)) > threshold) {
      return true;
    }
  }
  return false;
}

function changedCells(a: Pixels, b: Pixels, cell: number, threshold: number): boolean[][] {
  const cols = Math.ceil(a.width / cell);
  const rows = Math.ceil(a.height / cell);
  const probe = Math.min(PROBE, cell);
  const cells = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  for (let top = 0; top < a.height; top += probe) {
    for (let left = 0; left < a.width; left += probe) {
      if (blockChanged(a, b, left, top, probe, threshold)) {
        cells[Math.floor(top / cell)][Math.floor(left / cell)] = true;
      }
    }
  }
  return cells;
}

function component(cells: boolean[][], seen: boolean[][], row: number, col: number) {
  const box = { top: row, left: col, bottom: row, right: col };
  const stack = [[row, col]];
  seen[row][col] = true;
  while (stack.length) {
    const [r, c] = stack.pop()!;
    box.top = Math.min(box.top, r);
    box.bottom = Math.max(box.bottom, r);
    box.left = Math.min(box.left, c);
    box.right = Math.max(box.right, c);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (!cells[nr]?.[nc] || seen[nr][nc]) {
        continue;
      }
      seen[nr][nc] = true;
      stack.push([nr, nc]);
    }
  }
  return box;
}

export function changedRegions(a: Pixels, b: Pixels, options: DiffOptions = {}): Region[] {
  if (a.width !== b.width || a.height !== b.height) {
    return [WHOLE];
  }

  const cell = options.cell ?? DEFAULT_CELL;
  const cells = changedCells(a, b, cell, options.threshold ?? DEFAULT_THRESHOLD);
  const seen = cells.map((r) => r.map(() => false));
  const regions: Region[] = [];
  cells.forEach((cols, row) =>
    cols.forEach((changed, col) => {
      if (!changed || seen[row][col]) {
        return;
      }
      const box = component(cells, seen, row, col);
      const x = box.left * cell;
      const y = box.top * cell;
      regions.push({ x: x / a.width, y: y / a.height, w: (Math.min(a.width, (box.right + 1) * cell) - x) / a.width, h: (Math.min(a.height, (box.bottom + 1) * cell) - y) / a.height });
    })
  );
  return regions;
}
