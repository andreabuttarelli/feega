import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { maskPng } from './image-mask';
import { maskSchema } from '$lib/image-mask';

const SIZE = { width: 40, height: 20 };

async function pixels(png: Buffer): Promise<{ at: (x: number, y: number) => number; width: number; height: number }> {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, at: (x, y) => data[y * info.width + x] };
}

describe('maskPng', () => {
  it('is exactly the size of the picture, black where nothing was drawn', async () => {
    const mask = await pixels(await maskPng(SIZE, { regions: [{ left: 0.5, top: 0, width: 0.5, height: 1 }] }));

    expect({ width: mask.width, height: mask.height }).toEqual(SIZE);
    expect(mask.at(5, 10)).toBe(0);
  });

  it('paints a region white', async () => {
    const mask = await pixels(await maskPng(SIZE, { regions: [{ left: 0.5, top: 0, width: 0.5, height: 1 }] }));

    expect(mask.at(30, 10)).toBe(255);
    expect(mask.at(19, 10)).toBe(0);
  });

  it('paints a brush stroke as a round line as wide as the brush, measured on the shorter side', async () => {
    const mask = await pixels(await maskPng(SIZE, { strokes: [{ points: [[0.1, 0.5], [0.6, 0.5]], width: 0.3 }] }));

    expect(mask.at(12, 10)).toBe(255);
    expect(mask.at(12, 8)).toBe(255);
    expect(mask.at(12, 2)).toBe(0);
    expect(mask.at(35, 10)).toBe(0);
  });

  it('paints a single tap as a dot', async () => {
    const mask = await pixels(await maskPng(SIZE, { strokes: [{ points: [[0.5, 0.5]], width: 0.5 }] }));

    expect(mask.at(20, 10)).toBe(255);
    expect(mask.at(2, 10)).toBe(0);
  });

  it('keeps hard edges: only black and white', async () => {
    const mask = await pixels(await maskPng(SIZE, { strokes: [{ points: [[0.2, 0.2], [0.8, 0.7]], width: 0.25 }] }));
    const values = new Set<number>();
    for (let y = 0; y < SIZE.height; y += 1) {
      for (let x = 0; x < SIZE.width; x += 1) {
        values.add(mask.at(x, y));
      }
    }

    expect([...values].every((value) => value === 0 || value === 255)).toBe(true);
  });
});

describe('maskSchema', () => {
  it('accepts strokes and regions in fractions, and needs at least one mark', () => {
    expect(maskSchema.safeParse({ strokes: [{ points: [[0.1, 0.2]], width: 0.1 }] }).success).toBe(true);
    expect(maskSchema.safeParse({ regions: [{ left: 0, top: 0, width: 1, height: 1 }] }).success).toBe(true);
    expect(maskSchema.safeParse({}).success).toBe(false);
    expect(maskSchema.safeParse({ strokes: [{ points: [[2, 0]], width: 0.1 }] }).success).toBe(false);
  });
});
