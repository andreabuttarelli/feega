import { describe, expect, it } from 'vitest';
import { Direction } from '@feega/motion-core/motion/layout/auto-layout';
import { flowOf } from './flow';

const box = (left: number, top: number, width = 100, height = 80) => ({ left, top, width, height });

describe('the flow a stack takes from where things already sit', () => {
  it('a row 60 apart is horizontal with a gap of 60, in reading order', () => {
    expect(flowOf([box(320, 0), box(0, 0), box(160, 0)])).toMatchObject({ direction: Direction.Horizontal, gap: 60, order: [1, 2, 0] });
  });

  it('a column is vertical', () => {
    expect(flowOf([box(0, 0), box(0, 120)])).toMatchObject({ direction: Direction.Vertical, gap: 40 });
  });

  it('hugs a staggered row at its top, as tall as the tallest', () => {
    expect(flowOf([box(0, 0, 60, 40), box(120, 20, 60, 40), box(240, 40, 60, 40)]).box).toEqual({ left: 0, top: 0, width: 300, height: 40 });
  });

  it('overlapping things never get a negative gap', () => {
    expect(flowOf([box(0, 0), box(50, 0)]).gap).toBe(0);
  });
});
