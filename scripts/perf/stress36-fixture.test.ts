import { describe, expect, it } from 'vitest';
import { grid, overlaps } from './stress36-fixture.mjs';

describe('stress36 grid', () => {
  const sizes = Array.from({ length: 36 }, (_, i) => ({ width: 1280, height: 2000 + ((i * 7919) % 8000) }));
  const at = grid(sizes);
  const boxes = sizes.map((s, i) => ({ id: String(i), ...at[i], ...s }));

  it('lays 36 frames in 22 columns without overlaps', () => {
    expect(overlaps(boxes)).toEqual([]);
    expect(new Set(at.map((p) => p.y)).size).toBe(2);
    expect(at.filter((p) => p.y === 0)).toHaveLength(22);
  });

  it('keeps 20 px between columns and 40 px between rows', () => {
    const row = boxes.filter((b) => b.y === 0).sort((a, b) => a.x - b.x);
    expect(row[1].x - (row[0].x + row[0].width)).toBe(20);
    const second = Math.max(...at.map((p) => p.y));
    expect(second - Math.max(...row.map((b) => b.height))).toBe(40);
  });

  it('finds an overlap when there is one', () => {
    expect(overlaps([{ id: 'a', x: 0, y: 0, width: 10, height: 10 }, { id: 'b', x: 5, y: 5, width: 10, height: 10 }])).toEqual([['a', 'b']]);
  });
});
