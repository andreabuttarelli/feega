import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { frameDensities, frameStats, seamLuma } from './frame-stats';
import { EMPTY_EDGE_DENSITY } from '$lib/motion/emptiness';

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
    expect(black.litShare).toBe(0);
    expect(half.litShare).toBeGreaterThan(0.5);
  });
});

describe('how much is drawn on a frame', () => {
  it('a flat frame is empty, a frame of stripes is full, on the same measure as the eval', async () => {
    const [flat, stripes] = await frameDensities([
      { time: 0, bytes: await jpeg(pixels(() => 10)) },
      { time: 1, bytes: await jpeg(pixels((x) => (x % 4 < 2 ? 0 : 255))) }
    ]);

    expect(flat).toBeLessThan(EMPTY_EDGE_DENSITY);
    expect(stripes).toBeGreaterThan(EMPTY_EDGE_DENSITY);
  });
});

describe('the loop seam between the last frame and the first', () => {
  it('is near zero when the video ends where it began, large when it cuts to something else', async () => {
    const dark = await jpeg(pixels(() => 20));
    const light = await jpeg(pixels(() => 220));

    expect(await seamLuma([{ time: 0, bytes: dark }, { time: 9.9, bytes: dark }])).toBeLessThan(2);
    expect(await seamLuma([{ time: 0, bytes: dark }, { time: 9.9, bytes: light }])).toBeGreaterThan(150);
    expect(await seamLuma([{ time: 0, bytes: dark }])).toBeNull();
  });
});
