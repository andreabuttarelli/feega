import { describe, expect, it } from 'vitest';
import { BENTO_DEFAULTS, bentoCells, bentoPx, type BentoRect } from './bento';

const FULL_HD = { width: 1920, height: 1080 };
const VERTICAL = { width: 1080, height: 1920 };

const right = (r: BentoRect) => r.left + r.width;
const bottom = (r: BentoRect) => r.top + r.height;

function margins(rects: BentoRect[], frame: { width: number; height: number }) {
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: frame.width - Math.max(...rects.map(right)),
    bottom: frame.height - Math.max(...rects.map(bottom))
  };
}

function gutters(rects: BentoRect[]): number[] {
  return rects.flatMap((a) => {
    const toRight = rects.filter((b) => a.top < bottom(b) && b.top < bottom(a) && b.left > right(a)).map((b) => b.left - right(a));
    const below = rects.filter((b) => a.left < right(b) && b.left < right(a) && b.top > bottom(a)).map((b) => b.top - bottom(a));
    return [toRight, below].filter((d) => d.length).map((d) => Math.min(...d));
  });
}

const close = (values: number[], to: number) => values.every((v) => Math.abs(v - to) < 1e-6);

describe('bento: one gap between cells and towards the edge', () => {
  it.each([
    [1, 1],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 3]
  ])('%i×%i: the outer margin equals the gutter between cells, both ways', (columns, rows) => {
    const gap = 30;
    const cells = bentoCells({ columns, rows, gap }, Array(columns * rows).fill({}), FULL_HD);
    const edge = margins(cells.map((c) => c.rect), FULL_HD);

    expect(cells).toHaveLength(columns * rows);
    expect(close([edge.left, edge.top, edge.right, edge.bottom], gap)).toBe(true);
    expect(close(gutters(cells.map((c) => c.rect)), gap)).toBe(true);
  });

  it('a cell spanning two columns covers the gutter it swallows, and the rest still flows around it', () => {
    const cells = bentoCells({ columns: 3, rows: 2, gap: 20 }, [{ columns: 2, rows: 2 }, {}, {}], FULL_HD);
    const [big, a, b] = cells.map((c) => c.rect);
    const unit = (1920 - 20 * 4) / 3;

    expect(big.width).toBeCloseTo(unit * 2 + 20);
    expect(big.height).toBeCloseTo((1080 - 20 * 3) / 2 * 2 + 20);
    expect(a.left).toBeCloseTo(right(big) + 20);
    expect(b.top).toBeCloseTo(bottom(a) + 20);
    expect(close(gutters([big, a, b]), 20)).toBe(true);
  });

  it('drops an item that no longer fits rather than overlapping another cell', () => {
    const cells = bentoCells({ columns: 2, rows: 1, gap: 10 }, [{}, {}, {}], FULL_HD);

    expect(cells.map((c) => c.item)).toEqual([0, 1]);
  });

  it('fills the free slots with empty cells so the grid reads whole', () => {
    const cells = bentoCells({ columns: 2, rows: 2, gap: 10 }, [{}], FULL_HD);

    expect(cells.map((c) => c.item)).toEqual([0, null, null, null]);
  });

  it('a span wider than the grid is clamped to it', () => {
    const [only] = bentoCells({ columns: 2, rows: 1, gap: 10 }, [{ columns: 5, rows: 3 }], FULL_HD);

    expect(only.rect).toEqual({ left: 10, top: 10, width: 1900, height: 1060 });
  });
});

describe('bento sizes are written for 1080p and scale with the frame', () => {
  it('the default radius is above zero', () => {
    expect(BENTO_DEFAULTS.radius).toBeGreaterThan(0);
  });

  it('scales on the short side: same pixels at 1080p, landscape or vertical', () => {
    expect(bentoPx(24, FULL_HD)).toBe(24);
    expect(bentoPx(24, VERTICAL)).toBe(24);
    expect(bentoPx(24, { width: 1280, height: 720 })).toBe(16);
  });
});
