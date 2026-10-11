import sharp from 'sharp';
import type { Frame } from './frames';

const TILE_WIDTH = 320;
const COLUMNS = 4;
const GAP = 4;
const QUALITY = 78;
const GREY = { r: 128, g: 128, b: 128 };

export async function tileSheet(frames: readonly Frame[]): Promise<Buffer> {
  const tiles = await Promise.all(frames.map((f) => sharp(f.bytes).resize({ width: TILE_WIDTH }).jpeg().toBuffer({ resolveWithObject: true })));
  const tileHeight = Math.max(...tiles.map((t) => t.info.height));
  const columns = Math.min(COLUMNS, tiles.length);
  const rows = Math.ceil(tiles.length / columns);
  const width = columns * TILE_WIDTH + (columns - 1) * GAP;
  const height = rows * tileHeight + (rows - 1) * GAP;
  const composite = tiles.map((t, i) => ({ input: t.data, left: (i % columns) * (TILE_WIDTH + GAP), top: Math.floor(i / columns) * (tileHeight + GAP) }));

  return sharp({ create: { width, height, channels: 3, background: GREY } })
    .composite(composite)
    .jpeg({ quality: QUALITY })
    .toBuffer();
}
