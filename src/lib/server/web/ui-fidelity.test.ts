import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { AppTab } from './browser';
import { VectorKind, VectorRole, type VectorUi } from '$lib/motion/vector-ui/model';
import { similarity, uiFidelity } from './ui-fidelity';

const W = 320;
const H = 200;

const picture = (draw: (x: number, y: number) => number) => {
  const pixels = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      pixels[y * W + x] = draw(x, y);
    }
  }
  return sharp(pixels, { raw: { width: W, height: H, channels: 1 } }).jpeg().toBuffer();
};

const stripes = (x: number) => (Math.floor(x / 20) % 2 ? 230 : 30);
const blocks = (x: number, y: number) => ((Math.floor(x / 40) + Math.floor(y / 40)) % 2 ? 200 : 60);

const UI: VectorUi = { url: 'https://x.test/app', title: '', width: 1280, height: 800, background: 'rgb(255, 255, 255)', fonts: [], raster: [], nodes: [{ id: 'heading-0', role: VectorRole.Heading, kind: VectorKind.Text, x: 10, y: 10, w: 200, h: 40, text: 'make a video.', size: 32 }] };

describe('how close a rebuilt UI is to the page', () => {
  it('is 1 for the same picture', async () => {
    const a = await picture(stripes);

    expect(await similarity(a, a)).toBeGreaterThan(0.99);
  });

  it('is low for a different picture', async () => {
    expect(await similarity(await picture(stripes), await picture(blocks))).toBeLessThan(0.6);
  });

  it('paints the vector UI at the page size and compares it with the screenshot', async () => {
    const page = await picture(stripes);
    const paint = vi.fn(async () => page);
    const tab = { paint } as unknown as AppTab;

    const score = await uiFidelity(tab, UI, page);

    expect(score).toBeGreaterThan(0.99);
    expect(paint).toHaveBeenCalledWith(expect.stringContaining('make a video.'), { width: 1280, height: 800 });
  });
});
