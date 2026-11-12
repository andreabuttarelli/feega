import { describe, expect, it } from 'vitest';
import { pointerMoves } from './pointer-moved';

describe('pointerMoves', () => {
  it('a move the browser re-sends at the same spot, after the page changed under it, is not a move', () => {
    const moved = pointerMoves();

    expect(moved({ x: 10, y: 20 })).toBe(true);
    expect(moved({ x: 10, y: 20 })).toBe(false);
    expect(moved({ x: 11, y: 20 })).toBe(true);
  });
});
