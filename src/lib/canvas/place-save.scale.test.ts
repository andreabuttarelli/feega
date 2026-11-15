import { describe, expect, it } from 'vitest';
import { placedRows } from './place-save';

const SIZE = 2000;
const ID_READS_PER_ROW = 10;

describe('placed rows', () => {
  it('lands many pending moves reading each row id a bounded number of times', () => {
    let reads = 0;
    const rows = Array.from({ length: SIZE }, (_, i) => {
      const row = { x: 0, y: 0, w: 10, h: 10 } as { id: string; x: number; y: number; w: number; h: number };
      Object.defineProperty(row, 'id', {
        enumerable: true,
        get() {
          reads += 1;
          return `n${i}`;
        }
      });
      return row;
    });
    const entries = rows.map((_, i) => ({ action: 'move', id: `n${i}`, fields: { x: 5, y: 7 } }));
    reads = 0;

    const placed = placedRows(rows, entries, () => new Set());

    expect(placed.every((r) => r.x === 5 && r.y === 7)).toBe(true);
    expect(reads).toBeLessThan(SIZE * ID_READS_PER_ROW);
  });
});
