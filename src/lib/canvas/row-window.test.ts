import { describe, expect, it } from 'vitest';
import { rowWindow } from './row-window';

const ROW = 33;

describe('rowWindow', () => {
  it('renders only the rows in view plus the overscan', () => {
    expect(rowWindow({ scrollTop: 330, height: 330, count: 500, rowPx: ROW, overscan: 5 })).toEqual({ start: 5, end: 25 });
  });

  it('clamps at the top of the list', () => {
    expect(rowWindow({ scrollTop: 0, height: 330, count: 500, rowPx: ROW, overscan: 5 })).toEqual({ start: 0, end: 15 });
  });

  it('clamps at the bottom of the list', () => {
    expect(rowWindow({ scrollTop: 99_999, height: 330, count: 500, rowPx: ROW, overscan: 5 })).toEqual({ start: 495, end: 500 });
  });

  it('counts a list scrolled above its own top as not scrolled', () => {
    expect(rowWindow({ scrollTop: -200, height: 330, count: 3, rowPx: ROW, overscan: 5 })).toEqual({ start: 0, end: 3 });
  });
});
