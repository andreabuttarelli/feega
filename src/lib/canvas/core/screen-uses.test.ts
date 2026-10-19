import { describe, expect, it } from 'vitest';
import { screenUses, type PutFrame } from './screen-uses';

const SCREEN = { width: 800, height: 600 };
const frame = (id: string, x: number): PutFrame => ({ id, group: `${id}:1`, box: { x, y: 0, w: 200, h: 100 }, size: { width: 100, height: 50 } });

describe('screen uses', () => {
  it('places each put frame with one matrix: camera times box over doc size', () => {
    const screen = screenUses([frame('a', 0)], { x: 10, y: 20, zoom: 0.5 }, SCREEN, null);
    expect(screen.items).toEqual([{ kind: 'use', clip: 'a', group: 'a:1', matrix: [1, 0, 0, 1, 10, 20] }]);
  });

  it('a pan changes only matrices', () => {
    const at = (x: number) => screenUses([frame('a', 100)], { x, y: 0, zoom: 1 }, SCREEN, null).items[0];
    expect(at(0)).toMatchObject({ group: 'a:1', matrix: [2, 0, 0, 2, 100, 0] });
    expect(at(-40)).toMatchObject({ group: 'a:1', matrix: [2, 0, 0, 2, 60, 0] });
  });

  it('leaves off-screen frames out of the screen list', () => {
    expect(screenUses([frame('in', 0), frame('out', 5000)], { x: 0, y: 0, zoom: 1 }, SCREEN, null).items.map((u) => u.clip)).toEqual(['in']);
  });

  it('carries the screen size and background', () => {
    expect(screenUses([], { x: 0, y: 0, zoom: 1 }, SCREEN, null)).toEqual({ width: 800, height: 600, background: null, items: [] });
  });
});
