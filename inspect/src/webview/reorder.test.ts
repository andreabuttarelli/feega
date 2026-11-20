import { describe, expect, it } from 'vitest';
import { Place } from '@feega/live-edit/move-node';
import type { Pick } from '../messages';
import { DropKind, dropOf } from './reorder';

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

  it('the middle of a container drops inside it, with an outline', () => {
    const box = { ...el(5, 0, 100, 200, 100, []), elements: 2 } as Pick;

    expect(dropOf(dragged, box, { x: 100, y: 150 })).toMatchObject({ kind: DropKind.Inside, place: Place.Inside, line: { x: 0, y: 100, w: 200, h: 100 } });
  });

  it('the edge of a container is not a drop when it is not a sibling', () => {
    const box = { ...el(5, 0, 100, 200, 100, []), elements: 2 } as Pick;

    expect(dropOf(dragged, box, { x: 100, y: 102 })).toBeNull();
  });

  it('two instances of one loop item reorder by their index', () => {
    const item = (index: number, y: number) => ({ ...el(9, 0, y), instances: 3, instanceIndex: index }) as unknown as Pick;

    expect(dropOf(item(0, 0), item(2, 80), { x: 50, y: 95 })).toMatchObject({ kind: DropKind.Loop, loop: { from: 0, to: 2 }, line: { x: 0, y: 100, w: 100, h: 0 } });
  });
});
