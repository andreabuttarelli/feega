import { describe, expect, it } from 'vitest';
import { worldUses, type PutFrame } from './screen-uses';

const frame = (id: string, x: number): PutFrame => ({ id, group: `${id}:1`, box: { x, y: 0, w: 200, h: 100 }, size: { width: 100, height: 50 } });

describe('world uses', () => {
  it('places each put frame with one matrix: box over doc size, no camera', () => {
    expect(worldUses([frame('a', 10)])).toEqual([{ kind: 'use', clip: 'a', group: 'a:1', matrix: [2, 0, 0, 2, 10, 0] }]);
  });

  it('keeps every frame: the core culls by what it rasters', () => {
    expect(worldUses([frame('in', 0), frame('out', 5000)]).map((u) => u.clip)).toEqual(['in', 'out']);
  });

  it('asks the core to cache a still frame', () => {
    const [use] = worldUses([{ ...frame('a', 0), cache: true }]);
    expect(use).toMatchObject({ group: 'a:1', cache: true });
    expect(use).not.toHaveProperty('hold');
  });

  it('a held frame asks the core to keep its texture while it is edited', () => {
    const [use] = worldUses([{ ...frame('a', 0), cache: true, hold: true }]);
    expect(use).toMatchObject({ cache: true, hold: true });
  });

  it('turns a rotated frame about its world pivot', () => {
    const turned = { ...frame('a', 0), size: { width: 200, height: 100 }, turn: { degrees: 90, about: { x: 100, y: 50 } } };
    const [use] = worldUses([turned]);
    const at = (x: number, y: number) => [use.matrix[0] * x + use.matrix[2] * y + use.matrix[4], use.matrix[1] * x + use.matrix[3] * y + use.matrix[5]].map((v) => Math.round(v) + 0);

    expect(at(100, 50)).toEqual([100, 50]);
    expect(at(200, 50)).toEqual([100, 150]);
  });
});
