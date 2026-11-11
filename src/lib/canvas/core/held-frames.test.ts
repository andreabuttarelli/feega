import { describe, expect, it } from 'vitest';
import { heldFrames } from './held-frames';

const base = (id: string) => id.split('@')[0];
const none = { resizing: new Set<string>(), heldOnResize: () => true, moving: [] as string[], shown: [] as string[], base };

describe('frames held as a texture during a gesture', () => {
  it('holds every frame being dragged, so a move only shifts its texture instead of re-rasterising the page', () => {
    expect([...heldFrames({ ...none, moving: ['a', 'b'] })]).toEqual(['a', 'b']);
  });

  it('holds the responsive views that follow a dragged frame', () => {
    expect([...heldFrames({ ...none, moving: ['a'], shown: ['a', 'a@bp:tablet', 'a@bp:phone', 'c@bp:tablet'] })]).toEqual(['a', 'a@bp:tablet', 'a@bp:phone']);
  });

  it('holds a resized frame only when its kind paints held on resize', () => {
    expect([...heldFrames({ ...none, resizing: new Set(['a', 'b']), heldOnResize: (id) => id === 'a' })]).toEqual(['a']);
  });
});
