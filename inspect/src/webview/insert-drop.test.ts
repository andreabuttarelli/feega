import { describe, expect, it } from 'vitest';
import { AddPlace } from '@feega/live-edit/add-node';
import type { Pick } from '../messages';
import { Axis, axisOf, dropIndex, insertSpot, rowPlace } from './insert-drop';

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

const STACK = [rect(0, 0, 100, 40), rect(0, 40, 100, 40), rect(0, 80, 100, 40)];
const ROW = [rect(0, 0, 50, 40), rect(50, 0, 50, 40), rect(100, 0, 50, 40)];

const pick = (box: ReturnType<typeof rect>, extra: Partial<Pick> = {}) => ({ source: { file: 'a.svelte', line: 3, col: 3 }, tag: 'p', rect: box, styles: {}, elements: 0, ancestors: [], ...extra }) as unknown as Pick;

describe('axisOf', () => {
  it('reads a flex row', () => {
    expect(axisOf({ display: 'flex', 'flex-direction': 'row' })).toBe(Axis.Row);
    expect(axisOf({ display: 'inline-flex' })).toBe(Axis.Row);
  });

  it('reads a flex column, a grid and a block as a vertical stack', () => {
    expect(axisOf({ display: 'flex', 'flex-direction': 'column' })).toBe(Axis.Column);
    expect(axisOf({ display: 'grid' })).toBe(Axis.Column);
    expect(axisOf({ display: 'block' })).toBe(Axis.Column);
  });
});

describe('dropIndex', () => {
  it('counts the siblings whose middle is before the pointer in a column', () => {
    expect(dropIndex({ x: 10, y: 5 }, STACK, Axis.Column).index).toBe(0);
    expect(dropIndex({ x: 10, y: 50 }, STACK, Axis.Column).index).toBe(1);
    expect(dropIndex({ x: 10, y: 119 }, STACK, Axis.Column).index).toBe(3);
  });

  it('uses the horizontal position in a row', () => {
    expect(dropIndex({ x: 60, y: 5 }, ROW, Axis.Row).index).toBe(1);
    expect(dropIndex({ x: 149, y: 5 }, ROW, Axis.Row).index).toBe(3);
  });

  it('draws a horizontal line at the top of the next sibling in a column', () => {
    expect(dropIndex({ x: 10, y: 50 }, STACK, Axis.Column).line).toEqual({ x: 0, y: 40, w: 100, h: 0 });
  });

  it('draws the line after the last sibling when the index is past the end', () => {
    expect(dropIndex({ x: 10, y: 119 }, STACK, Axis.Column).line).toEqual({ x: 0, y: 120, w: 100, h: 0 });
  });

  it('draws a vertical line in a row', () => {
    expect(dropIndex({ x: 60, y: 5 }, ROW, Axis.Row).line).toEqual({ x: 50, y: 0, w: 0, h: 40 });
  });

  it('is index 0 with no siblings', () => {
    expect(dropIndex({ x: 1, y: 1 }, [], Axis.Column).index).toBe(0);
  });
});

describe('insertSpot', () => {
  const PARENT_ROW = pick(rect(0, 0, 300, 100), { styles: { display: 'flex', 'flex-direction': 'row' } });

  it('goes inside the middle of a container', () => {
    const spot = insertSpot(pick(rect(0, 0, 200, 200), { tag: 'div', elements: 2 }), null, { x: 100, y: 100 });

    expect(spot.place).toBe(AddPlace.Child);
  });

  it('goes before or after a leaf along the layout direction of its parent', () => {
    const leaf = pick(rect(100, 0, 100, 40));

    expect(insertSpot(leaf, PARENT_ROW, { x: 110, y: 20 }).place).toBe(AddPlace.Before);
    expect(insertSpot(leaf, PARENT_ROW, { x: 190, y: 20 }).place).toBe(AddPlace.After);
    expect(insertSpot(leaf, PARENT_ROW, { x: 190, y: 20 }).line).toEqual({ x: 200, y: 0, w: 0, h: 40 });
  });

  it('falls back to a vertical stack without a parent', () => {
    const leaf = pick(rect(0, 100, 100, 40));

    expect(insertSpot(leaf, null, { x: 10, y: 105 }).place).toBe(AddPlace.Before);
    expect(insertSpot(leaf, null, { x: 10, y: 135 }).place).toBe(AddPlace.After);
  });

  it('goes before or after the edge of a container, not inside', () => {
    const box = pick(rect(0, 0, 200, 200), { tag: 'div', elements: 2 });

    expect(insertSpot(box, null, { x: 100, y: 10 }).place).toBe(AddPlace.Before);
  });
});

describe('rowPlace', () => {
  it('maps the top edge, the middle and the bottom edge of a Layers row', () => {
    expect(rowPlace(0.1)).toBe(AddPlace.Before);
    expect(rowPlace(0.5)).toBe(AddPlace.Child);
    expect(rowPlace(0.9)).toBe(AddPlace.After);
  });
});
