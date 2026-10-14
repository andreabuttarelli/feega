import { describe, expect, it } from 'vitest';
import { Dismiss, dismissFrom, spatialStep } from './browser';

describe('Escape in the component library', () => {
  it('closes the open component first, keeping the grid', () => {
    expect(dismissFrom('builtin:prompt-input')).toBe(Dismiss.Detail);
  });

  it('closes the library when nothing is open', () => {
    expect(dismissFrom(null)).toBe(Dismiss.Library);
  });
});

describe('arrow keys move to the nearest card on screen', () => {
  const rect = (x: number, y: number, width = 100, height = 60) => ({ x, y, width, height });
  const wide = [rect(0, 0), rect(110, 0), rect(220, 0), rect(0, 70)];
  const tall = [rect(0, 160, 50, 90), rect(60, 160, 50, 90), rect(120, 160, 50, 90)];
  const cards = [...wide, ...tall];

  it('moves one card sideways along a row', () => {
    expect(spatialStep(cards, 1, 'ArrowRight')).toBe(2);
    expect(spatialStep(cards, 1, 'ArrowLeft')).toBe(0);
  });

  it('moves down into the next row, and from a wide group into a tall one below', () => {
    expect(spatialStep(cards, 0, 'ArrowDown')).toBe(3);
    expect(spatialStep(cards, 3, 'ArrowDown')).toBe(4);
    expect(spatialStep(cards, 5, 'ArrowUp')).toBe(3);
  });

  it('stays put at an edge', () => {
    expect(spatialStep(cards, 0, 'ArrowLeft')).toBe(0);
    expect(spatialStep(cards, 2, 'ArrowUp')).toBe(2);
    expect(spatialStep(cards, 6, 'ArrowDown')).toBe(6);
  });

  it('jumps to the ends with Home and End', () => {
    expect(spatialStep(cards, 3, 'Home')).toBe(0);
    expect(spatialStep(cards, 3, 'End')).toBe(cards.length - 1);
  });

  it('ignores any other key', () => {
    expect(spatialStep(cards, 3, 'a')).toBeNull();
  });
});
