import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { frameStats } from './frame-stats';

const W = 160;
const H = 90;

const jpeg = (raw: Buffer) => sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg().toBuffer();

function pixels(paint: (x: number, y: number) => number): Buffer {
  const raw = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      raw.fill(paint(x, y), (y * W + x) * 3, (y * W + x) * 3 + 3);
    }
  }
  return raw;
}

describe('what a frame looks like, in numbers', () => {
  it('a flat black frame has no spread; a frame with a white half is half white', async () => {
    const flat = await jpeg(pixels(() => 10));
    const halfWhite = await jpeg(pixels((x) => (x < W / 2 ? 255 : (x * 7) % 200)));

    const [black, half] = await frameStats([
      { time: 0, bytes: flat },
      { time: 1, bytes: halfWhite }
    ]);

    expect(black).toMatchObject({ time: 0, whiteShare: 0 });
    expect(black.lumaStd).toBeLessThan(2);
    expect(half.whiteShare).toBeGreaterThan(0.4);
    expect(half.lumaStd).toBeGreaterThan(20);
  });
});
