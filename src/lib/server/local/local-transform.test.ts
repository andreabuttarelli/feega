import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { transformed } from './local-transform';
import { transformQuery } from './transform-query';

const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#c33' } }).png().toBuffer();
const asked = (query: string) => new URL(`http://x/local/storage/b/p.png${query}`).searchParams;

describe('local storage serves image sizes like Supabase render', () => {
  it('puts the transform on the signed URL', () => {
    expect(transformQuery({ width: 512, height: 512, resize: 'contain', quality: 75 })).toBe('?width=512&height=512&resize=contain&quality=75');
  });

  it('shrinks an image inside the asked box (the bench downloaded full originals for every tier)', async () => {
    const out = await transformed({ bytes: new Uint8Array(await png(2000, 1000)), contentType: 'image/png' }, asked('?width=512&height=512&resize=contain&quality=75'));
    const meta = await sharp(Buffer.from(out.bytes)).metadata();

    expect([meta.width, meta.height]).toEqual([512, 256]);
  });

  it('serves the original when no size is asked, or the file is not an image', async () => {
    const blob = { bytes: new Uint8Array([1, 2, 3]), contentType: 'font/woff2' };

    expect(await transformed(blob, asked('?width=512&height=512'))).toBe(blob);
    const image = { bytes: new Uint8Array(await png(10, 10)), contentType: 'image/png' };
    expect(await transformed(image, asked(''))).toBe(image);
  });
});
