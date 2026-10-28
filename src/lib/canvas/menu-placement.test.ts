import { describe, expect, it } from 'vitest';
import { placeMenu } from './menu-placement';

const VIEWPORT = { width: 1000, height: 800 };
const MARGIN = 8;

describe('placeMenu', () => {
  it('opens at the anchor when it fits', () => {
    expect(placeMenu({ anchor: { x: 100, y: 100 }, size: { width: 200, height: 300 }, viewport: VIEWPORT })).toEqual({ x: 100, y: 100, maxHeight: 784, scrollable: false });
  });

  it('shifts up when the space below is short but the viewport is tall enough', () => {
    const placed = placeMenu({ anchor: { x: 100, y: 700 }, size: { width: 200, height: 300 }, viewport: VIEWPORT });
    expect(placed.y).toBe(VIEWPORT.height - MARGIN - 300);
    expect(placed.scrollable).toBe(false);
  });

  it('shifts left when the menu would cross the right edge', () => {
    const placed = placeMenu({ anchor: { x: 950, y: 100 }, size: { width: 200, height: 100 }, viewport: VIEWPORT });
    expect(placed.x).toBe(VIEWPORT.width - MARGIN - 200);
  });

  it('caps the height and scrolls when the menu is taller than the viewport', () => {
    const placed = placeMenu({ anchor: { x: 100, y: 700 }, size: { width: 200, height: 2000 }, viewport: VIEWPORT });
    expect(placed).toEqual({ x: 100, y: MARGIN, maxHeight: VIEWPORT.height - 2 * MARGIN, scrollable: true });
  });
});
