import { describe, expect, it } from 'vitest';
import { dotBackground, dotGrid } from './dot-grid';

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

describe('dotBackground', () => {
  it('tiles one centred dot per gap, scrolled with the pane, as the scene grid does', () => {
    expect(dotBackground({ x: 30, y: -10, zoom: 2 })).toEqual({
      'background-image': 'radial-gradient(circle, var(--ui-canvas-dot) 2px, transparent 2px)',
      'background-size': '48px 48px',
      'background-position': '30px -10px'
    });
  });

  it('stops shrinking the tile at a quarter zoom, where the scene grid stops', () => {
    expect(dotBackground({ x: 13, y: 0, zoom: 0.1 })).toMatchObject({ 'background-size': '6px 6px', 'background-position': '1px 0px' });
  });
});
