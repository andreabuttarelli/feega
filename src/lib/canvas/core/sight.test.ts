import { describe, expect, it } from 'vitest';
import { SpatialIndex } from './spatial-index';
import { sameSight, sightOf } from './sight';

const index = new SpatialIndex([
  { id: 'here', x: 0, y: 0, w: 100, h: 100 },
  { id: 'next', x: 500, y: 0, w: 100, h: 100 },
  { id: 'far', x: 5000, y: 0, w: 100, h: 100 }
]);
const area = { width: 400, height: 300 };

describe('sight', () => {
  it('splits what is on screen from what is one screen away', () => {
    const sight = sightOf(index, { x: 0, y: 0, zoom: 1 }, area);

    expect([...sight.onScreen]).toEqual(['here']);
    expect([...sight.near]).toEqual(['here', 'next']);
  });

  it('stays the same while a pan shows the same frames', () => {
    const before = sightOf(index, { x: 0, y: 0, zoom: 1 }, area);

    expect(sameSight(before, sightOf(index, { x: -1, y: 3, zoom: 1.01 }, area))).toBe(true);
  });

  it('changes when a frame crosses the screen edge', () => {
    const before = sightOf(index, { x: 0, y: 0, zoom: 1 }, area);

    expect(sameSight(before, sightOf(index, { x: -150, y: 0, zoom: 1 }, area))).toBe(false);
  });
});
