import { describe, expect, it } from 'vitest';
import { resident } from './residency';

const view = { x: 0, y: 0, zoom: 1 };
const screen = { width: 1000, height: 1000 };
const frame = (id: string, x: number, images: number) => ({ id, group: `${id}:1`, box: { x, y: 0, w: 100, h: 100 }, size: { width: 100, height: 100 }, images });

describe('frame residency', () => {
  it('vector frames stay resident wherever they are', () => {
    expect(resident([frame('v', 9000, 0)], view, screen, 0).map((f) => f.id)).toEqual(['v']);
  });

  it('media frames are resident only on screen', () => {
    expect(resident([frame('on', 0, 1), frame('off', 9000, 1)], view, screen, 1e9).map((f) => f.id)).toEqual(['on']);
  });

  it('over budget, media frames beyond it are left out', () => {
    const bytes = 100 * 100 * 4;
    expect(resident([frame('a', 0, 1), frame('b', 200, 1)], view, screen, bytes).length).toBe(1);
  });
});
