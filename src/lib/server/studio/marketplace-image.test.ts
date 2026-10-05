import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { Marketplace, MARKETPLACES } from '$lib/studio/marketplace';
import { toMarketplace } from './marketplace-image';

async function photo(width: number, height: number): Promise<Uint8Array> {
  return new Uint8Array(await sharp({ create: { width, height, channels: 3, background: '#336699' } }).png().toBuffer());
}

describe('toMarketplace', () => {
  it.each(Object.values(Marketplace))('%s: esce alla misura e nel formato del canale', async (market) => {
    const out = await toMarketplace(await photo(600, 800), market);
    const meta = await sharp(out.bytes).metadata();
    const spec = MARKETPLACES[market];
    expect([meta.width, meta.height]).toEqual([spec.width, spec.height]);
    expect(meta.format).toBe('jpeg');
    expect(out.extension).toBe('jpg');
  });

  it('Amazon: un ritratto si centra su bianco puro, senza tagliare il prodotto', async () => {
    const out = await toMarketplace(await photo(600, 800), Marketplace.Amazon);
    const { data } = await sharp(out.bytes).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]);
  });
});
