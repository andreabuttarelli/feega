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

  it('asks the core to cache a still frame', () => {
    const [use] = screenUses([{ ...frame('a', 0), cache: true }], { x: 0, y: 0, zoom: 1 }, SCREEN, null).items;
    expect(use).toMatchObject({ group: 'a:1', cache: true });
    expect(use).not.toHaveProperty('hold');
  });

  it('a held frame asks the core to keep its texture while it is edited', () => {
    const [use] = screenUses([{ ...frame('a', 0), cache: true, hold: true }], { x: 0, y: 0, zoom: 1 }, SCREEN, null).items;
    expect(use).toMatchObject({ cache: true, hold: true });
  });

  it('sends cached frames within a screen of the viewport so the core rasters them ahead', () => {
    const near = { ...frame('near', 1000), cache: true };
    const far = { ...frame('far', 2000), cache: true };
    const plain = frame('plain', 1000);
    expect(screenUses([near, far, plain], { x: 0, y: 0, zoom: 1 }, SCREEN, null).items.map((u) => (u as { clip: string }).clip)).toEqual(['near']);
  });

  it('turns a rotated frame about its world pivot', () => {
    const turned = { ...frame('a', 0), size: { width: 200, height: 100 }, turn: { degrees: 90, about: { x: 100, y: 50 } } };
    const [use] = screenUses([turned], { x: 0, y: 0, zoom: 1 }, SCREEN, null).items as { matrix: number[] }[];
    const at = (x: number, y: number) => [use.matrix[0] * x + use.matrix[2] * y + use.matrix[4], use.matrix[1] * x + use.matrix[3] * y + use.matrix[5]].map((v) => Math.round(v) + 0);

    expect(at(100, 50)).toEqual([100, 50]);
    expect(at(200, 50)).toEqual([100, 150]);
  });
});
