import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fontAdvance } from './font-advance';

const FONT = readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf');
const served = () => new Response(new Uint8Array(FONT));

describe('fontAdvance', () => {
  it('reads glyph advances from the font file, in em', async () => {
    const advance = await fontAdvance(vi.fn(async () => served()))('https://fonts.test/a.ttf');

    expect(advance!('i')).toBeLessThan(advance!('W'));
    expect(advance!('WW')).toBeGreaterThan(1);
  });

  it('downloads a font once', async () => {
    const fetcher = vi.fn(async () => served());
    const read = fontAdvance(fetcher);

    await read('https://fonts.test/b.ttf');
    await read('https://fonts.test/b.ttf');

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a font that cannot be fetched gives no advance', async () => {
    expect(await fontAdvance(async () => new Response('', { status: 404 }))('https://fonts.test/c.ttf')).toBeNull();
  });
});
