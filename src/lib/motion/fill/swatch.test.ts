import { describe, expect, it } from 'vitest';
import { FillType, fillsSchema } from './model';
import { swatchOf } from './swatch';

const paints = { color: (v: string) => v, picture: () => undefined };
const [linear, image] = fillsSchema.parse([
  { type: FillType.Linear, angle: 0, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }] },
  { type: FillType.Image, assetId: 'a' }
]);

describe('fill swatch', () => {
  it('a gradient swatch lists its stops in order', () => {
    expect(swatchOf(linear, paints)).toBe('linear-gradient(90deg,#000000 0%,#ffffff 100%)');
  });

  it('an image without a preview falls back to the neutral swatch', () => {
    expect(swatchOf(image, paints)).toBe('var(--ui-input)');
    expect(swatchOf(image, { ...paints, picture: () => 'https://x/y.png' })).toContain('url("https://x/y.png")');
  });
});
