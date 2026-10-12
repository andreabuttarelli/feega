import { describe, expect, it } from 'vitest';
import { Dismiss, dismissFrom, gridStep } from './browser';

describe('Escape in the component library', () => {
  it('closes the open component first, keeping the grid', () => {
    expect(dismissFrom('builtin:prompt-input')).toBe(Dismiss.Detail);
  });

  it('closes the library when nothing is open', () => {
    expect(dismissFrom(null)).toBe(Dismiss.Library);
  });
});

describe('arrow keys move across the grid', () => {
  const grid = { count: 7, columns: 3 };

  it('moves one card sideways and one row up or down', () => {
    expect(gridStep(1, 'ArrowRight', grid)).toBe(2);
    expect(gridStep(1, 'ArrowLeft', grid)).toBe(0);
    expect(gridStep(1, 'ArrowDown', grid)).toBe(4);
    expect(gridStep(4, 'ArrowUp', grid)).toBe(1);
  });

  it('stays inside the grid at its edges', () => {
    expect(gridStep(0, 'ArrowLeft', grid)).toBe(0);
    expect(gridStep(6, 'ArrowRight', grid)).toBe(6);
    expect(gridStep(5, 'ArrowDown', grid)).toBe(6);
    expect(gridStep(1, 'ArrowUp', grid)).toBe(1);
  });

  it('jumps to the ends with Home and End', () => {
    expect(gridStep(3, 'Home', grid)).toBe(0);
    expect(gridStep(3, 'End', grid)).toBe(6);
  });

  it('ignores any other key', () => {
    expect(gridStep(3, 'a', grid)).toBeNull();
  });
});
