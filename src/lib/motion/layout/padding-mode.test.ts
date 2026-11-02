import { describe, expect, it } from 'vitest';
import { PaddingView, SIDE_ORDER, paddingView, togglePadding } from './padding-mode';

const even = { top: 8, right: 16, bottom: 8, left: 16 };
const uneven = { top: 4, right: 10, bottom: 12, left: 20 };

describe('padding shows two chips or four', () => {
  it('shows horizontal and vertical while each pair matches', () => {
    expect(paddingView(even, false)).toBe(PaddingView.Axes);
  });

  it('shows four sides when a pair differs, even without asking', () => {
    expect(paddingView(uneven, false)).toBe(PaddingView.Sides);
  });

  it('lists the four sides left, top, right, bottom', () => {
    expect(SIDE_ORDER).toEqual(['left', 'top', 'right', 'bottom']);
  });
});

describe('the per-side toggle goes both ways', () => {
  it('opens four chips with the same values', () => {
    const next = togglePadding(even, PaddingView.Axes);
    expect(next).toEqual({ split: true, padding: null });
    expect(paddingView(even, next.split)).toBe(PaddingView.Sides);
  });

  it('closes back to two chips when the pairs match, writing nothing', () => {
    const next = togglePadding(even, PaddingView.Sides);
    expect(next).toEqual({ split: false, padding: null });
    expect(paddingView(even, next.split)).toBe(PaddingView.Axes);
  });

  it('closes back to two chips when the pairs differ, keeping the first of each pair', () => {
    const next = togglePadding(uneven, PaddingView.Sides);
    expect(next.padding).toEqual({ top: 4, right: 20, bottom: 4, left: 20 });
    expect(paddingView(next.padding!, next.split)).toBe(PaddingView.Axes);
  });
});
