import { describe, expect, it } from 'vitest';
import { ITEM_BYTES, heldBytes, overBudget } from './built-budget';

const view = { x: 0, y: 0, zoom: 1 };
const screen = { width: 400, height: 300 };
const at = (id: string, x: number, bytes: number) => ({ id, box: { x, y: 0, w: 100, h: 100 }, bytes });

describe('frames kept built on a phone', () => {
  it('keeps every built frame while they fit the budget', () => {
    expect(overBudget([at('a', 0, 40), at('b', 2000, 40)], view, screen, 100)).toEqual([]);
  });

  it('sends the frames farthest from the screen back to their snapshot until the rest fits', () => {
    const built = [at('seen', 50, 60), at('near', 600, 60), at('far', 5000, 60), at('farther', 9000, 60)];
    expect(overBudget(built, view, screen, 130)).toEqual(['farther', 'far']);
  });

  it('never sends back a frame on screen, even past the budget', () => {
    expect(overBudget([at('a', 0, 80), at('b', 150, 80)], view, screen, 100)).toEqual([]);
  });
});

describe('what a built frame weighs', () => {
  it('counts every item, inside groups and mattes too, at the bytes a phone pays for one', () => {
    const leaf = { kind: 'path' };
    const list = { items: [leaf, { kind: 'group', items: [leaf, leaf] }, { kind: 'path', matte: { items: [leaf] } }] };
    expect(heldBytes(list as never)).toBe(6 * ITEM_BYTES);
  });
});
