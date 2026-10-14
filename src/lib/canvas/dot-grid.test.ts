import { describe, expect, it } from 'vitest';
import { dotGrid } from './dot-grid';

describe('dotGrid', () => {
  it('pins a dot to every flow point that is a multiple of the gap, as the pane moves', () => {
    const grid = dotGrid({ x: 30, y: -10, zoom: 1 }, 24)!;

    expect(grid.first).toEqual({ x: 6, y: 14 });
    expect(grid.step).toBe(24);
  });

  it('scales spacing and dot size with zoom, like the dots it replaces', () => {
    const grid = dotGrid({ x: 0, y: 0, zoom: 2 }, 24)!;

    expect(grid.step).toBe(48);
    expect(grid.radius).toBe(1);
  });

  it('draws nothing once dots would blur into a haze far out', () => {
    expect(dotGrid({ x: 0, y: 0, zoom: 0.2 }, 24)).toBeNull();
  });
});
