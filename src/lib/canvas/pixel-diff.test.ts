import { describe, expect, it } from 'vitest';
import { changedRegions, type Pixels } from './pixel-diff';

const W = 64;
const H = 64;

const blank = (): Pixels => ({ width: W, height: H, data: new Uint8ClampedArray(W * H * 4).fill(255) });

function paint(p: Pixels, box: { x: number; y: number; w: number; h: number }): Pixels {
  const data = new Uint8ClampedArray(p.data);
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      data.set([0, 0, 0, 255], (y * W + x) * 4);
    }
  }
  return { ...p, data };
}

describe('le regioni cambiate tra due poster', () => {
  it('due immagini uguali non hanno regioni', () => {
    expect(changedRegions(blank(), blank())).toEqual([]);
  });

  it('una zona cambiata è una regione che la copre, in frazioni del poster', () => {
    const [region, ...rest] = changedRegions(blank(), paint(blank(), { x: 20, y: 36, w: 8, h: 8 }), { cell: 8 });

    expect(rest).toEqual([]);
    expect(region).toEqual({ x: 16 / W, y: 32 / H, w: 16 / W, h: 16 / H });
  });

  it('due zone lontane sono due regioni', () => {
    const after = paint(paint(blank(), { x: 0, y: 0, w: 4, h: 4 }), { x: 56, y: 56, w: 4, h: 4 });

    expect(changedRegions(blank(), after, { cell: 8 })).toHaveLength(2);
  });

  it('un rumore sotto la soglia non conta', () => {
    const noisy = { ...blank(), data: blank().data.map((v, i) => (i % 4 === 3 ? v : v - 3)) };

    expect(changedRegions(blank(), noisy)).toEqual([]);
  });

  it('dimensioni diverse sono un cambiamento su tutto il poster', () => {
    expect(changedRegions(blank(), { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) })).toEqual([{ x: 0, y: 0, w: 1, h: 1 }]);
  });
});
