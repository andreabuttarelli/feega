import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { paletteNote, paletteOf } from './palette';

async function striped(stripes: { hex: string; rows: number }[]): Promise<Buffer> {
  const width = 40;
  const rows = stripes.flatMap((s) => Array.from({ length: s.rows }, () => s.hex));
  const pixels = Buffer.from(rows.flatMap((hex) => Array.from({ length: width }, () => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))).flat()));
  return sharp(pixels, { raw: { width, height: rows.length, channels: 3 } }).png().toBuffer();
}

describe('the palette of a reference image', () => {
  it('lists its colours by the share of the frame they cover, largest first', async () => {
    const image = await striped([
      { hex: '#e0008a', rows: 60 },
      { hex: '#55ccff', rows: 25 },
      { hex: '#ff8800', rows: 15 }
    ]);

    const palette = await paletteOf(image);

    expect(palette.map((c) => c.hex)).toEqual(['#e0008a', '#55ccff', '#ff8800']);
    expect(palette[0].share).toBeCloseTo(0.6, 1);
  });

  it('versus run1: shades of one magenta gradient count as one colour, so the cyan accent is not crowded out', async () => {
    const shades = ['#d40088', '#e90196', '#fb03aa', '#b30173', '#c4007c', '#ff14f7'].map((hex) => ({ hex, rows: 15 }));
    const palette = await paletteOf(await striped([...shades, { hex: '#55ccff', rows: 10 }]));

    expect(palette.length).toBeLessThanOrEqual(3);
    expect(palette.map((c) => c.hex)).toContain('#55ccff');
  });

  it('leaves out specks: a colour on 1% of the picture is not its palette', async () => {
    const palette = await paletteOf(await striped([{ hex: '#e0008a', rows: 99 }, { hex: '#00ff00', rows: 1 }]));

    expect(palette.map((c) => c.hex)).toEqual(['#e0008a']);
  });

  it('versus run1: the abstract loop came out on a dark ground for a bright magenta reference, so the note says how light the ground is', async () => {
    const note = paletteNote(await paletteOf(await striped([{ hex: '#e0008a', rows: 80 }, { hex: '#55ccff', rows: 20 }])));

    expect(note).toContain('#e0008a 80%');
    expect(note).toContain('bright');
  });
});
