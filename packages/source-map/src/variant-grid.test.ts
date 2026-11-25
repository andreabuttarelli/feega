import { describe, expect, it } from 'vitest';
import { fitZoom, gridOf } from './variant-grid.js';

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

describe('fitZoom', () => {
  const canvas = { width: 1000, height: 600 };

  it('scales a small component up to the canvas', () => {
    expect(fitZoom({ width: 100, height: 50 }, canvas, 48)).toBe(4);
  });

  it('stops at the maximum zoom', () => {
    expect(fitZoom({ width: 10, height: 10 }, canvas, 48)).toBe(4);
  });

  it('never shrinks a component that already fills the canvas', () => {
    expect(fitZoom({ width: 2000, height: 100 }, canvas, 48)).toBe(1);
  });

  it('is limited by the tighter side', () => {
    expect(fitZoom({ width: 100, height: 400 }, canvas, 48)).toBeCloseTo(1.26, 2);
  });

  it('leaves an empty box alone', () => {
    expect(fitZoom({ width: 0, height: 0 }, canvas, 48)).toBe(1);
  });
});
