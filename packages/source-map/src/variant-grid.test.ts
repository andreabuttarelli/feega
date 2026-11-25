import { describe, expect, it } from 'vitest';
import { fitScale, gridOf } from './variant-grid.js';

const v = (props: Record<string, unknown>) => ({ label: Object.entries(props).map(([k, x]) => `${k}=${x}`).join(' · '), props });

describe('gridOf', () => {
  it('puts one prop in the columns and the others in the rows', () => {
    const grid = gridOf([v({ size: 'sm', tone: 'a' }), v({ size: 'sm', tone: 'b' }), v({ size: 'lg', tone: 'a' }), v({ size: 'lg', tone: 'b' })]);

    expect(grid.columns).toEqual(['a', 'b']);
    expect(grid.rows.map((row) => row.header)).toEqual(['size=sm', 'size=lg']);
    expect(grid.rows[1].cells.map((cell) => cell?.props)).toEqual([{ size: 'lg', tone: 'a' }, { size: 'lg', tone: 'b' }]);
  });

  it('uses one headerless row for a single prop', () => {
    const grid = gridOf([v({ open: false }), v({ open: true })]);

    expect(grid.columns).toEqual(['false', 'true']);
    expect(grid.rows).toHaveLength(1);
    expect(grid.rows[0].header).toBe('');
  });

  it('names the column prop so the header reads on its own', () => {
    expect(gridOf([v({ size: 'sm', tone: 'a' })]).columnName).toBe('tone');
  });

  it('leaves a gap where a combination is missing', () => {
    const grid = gridOf([v({ a: 1, b: 1 }), v({ a: 1, b: 2 }), v({ a: 2, b: 2 })]);

    expect(grid.rows[1].cells.map((cell) => cell?.props)).toEqual([undefined, { a: 2, b: 2 }]);
  });
});

describe('fitScale', () => {
  const canvas = { width: 1000, height: 600 };

  it('scales a small component up to the canvas', () => {
    expect(fitScale({ width: 100, height: 50 }, canvas, 48)).toBe(4);
  });

  it('stops at the maximum zoom', () => {
    expect(fitScale({ width: 10, height: 10 }, canvas, 48)).toBe(4);
  });

  it('shrinks a component that is larger than the canvas', () => {
    expect(fitScale({ width: 2000, height: 100 }, canvas, 48)).toBeCloseTo(0.45, 2);
  });

  it('is limited by the tighter side', () => {
    expect(fitScale({ width: 100, height: 400 }, canvas, 48)).toBeCloseTo(1.26, 2);
  });

  it('stops at the minimum zoom', () => {
    expect(fitScale({ width: 100000, height: 10 }, canvas, 48)).toBe(0.1);
  });

  it('leaves an empty box at real size', () => {
    expect(fitScale({ width: 0, height: 0 }, canvas, 48)).toBe(1);
  });
});
