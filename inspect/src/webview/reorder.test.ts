import { describe, expect, it } from 'vitest';
import { Place } from '@feega/live-edit/move-node';
import type { Pick } from '../messages';
import { dropOf } from './reorder';

const parent = { source: { file: 'a.svelte', line: 1, col: 1 }, name: 'nav' };
const el = (line: number, x: number, y: number, w = 100, h = 20, ancestors = [parent]) =>
  ({ source: { file: 'a.svelte', line, col: 3 }, rect: { x, y, width: w, height: h }, ancestors }) as unknown as Pick;

describe('dropOf', () => {
  const dragged = el(2, 0, 0);

  it('side by side siblings use the horizontal half', () => {
    const target = el(3, 120, 0);

    expect(dropOf(dragged, target, { x: 130, y: 10 })).toMatchObject({ place: Place.Before, line: { x: 120, y: 0, w: 0, h: 20 } });
    expect(dropOf(dragged, target, { x: 210, y: 10 })).toMatchObject({ place: Place.After, line: { x: 220, y: 0, w: 0, h: 20 } });
  });

  it('stacked siblings use the vertical half', () => {
    const target = el(3, 0, 40);

    expect(dropOf(dragged, target, { x: 50, y: 55 })).toMatchObject({ place: Place.After, line: { x: 0, y: 60, w: 100, h: 0 } });
  });

  it('a non sibling or the element itself is no drop', () => {
    expect(dropOf(dragged, el(3, 0, 40, 100, 20, []), { x: 1, y: 41 })).toBeNull();
    expect(dropOf(dragged, dragged, { x: 1, y: 1 })).toBeNull();
  });
});
