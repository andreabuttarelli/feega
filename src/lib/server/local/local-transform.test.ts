import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { resizedOnce, transformed } from './local-transform';
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

describe('local storage resizes each size once, a few at a time', () => {
  const blob = { bytes: new Uint8Array([1]), contentType: 'image/png' };
  const query = asked('?width=256&height=256');

  it('resizes a stored image once per size, however many times it is asked (one open asked 578 sizes from the same thread that parses frames)', async () => {
    const resize = vi.fn(async () => ({ bytes: new Uint8Array([2]), contentType: 'image/webp' }));
    const sized = resizedOnce(resize, 2);

    const [a, b] = await Promise.all([sized('b/p.png', blob, query), sized('b/p.png', blob, query)]);
    await sized('b/p.png', blob, query);

    expect(resize).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('runs only a few resizes at once, so frame sources are not queued behind a pile of them', async () => {
    const pending: (() => void)[] = [];
    const resize = vi.fn(() => new Promise<{ bytes: Uint8Array; contentType: string }>((done) => pending.push(() => done({ bytes: new Uint8Array(), contentType: 'image/webp' }))));
    const sized = resizedOnce(resize, 2);

    void sized('b/1.png', blob, query);
    void sized('b/2.png', blob, query);
    void sized('b/3.png', blob, query);
    await new Promise((r) => setTimeout(r, 0));

    expect(resize).toHaveBeenCalledTimes(2);
  });
});

describe('a stored file written again', () => {
  it('is resized again, never served from the old bytes', async () => {
    const blob = { bytes: new Uint8Array([1]), contentType: 'image/png' };
    const query = new URL('http://x/a?width=256&height=256').searchParams;
    const resize = vi.fn(async () => ({ bytes: new Uint8Array([2]), contentType: 'image/webp' }));
    const sized = resizedOnce(resize, 2);

    await sized('b/p.png', blob, query);
    sized.forget('b/p.png');
    await sized('b/p.png', blob, query);

    expect(resize).toHaveBeenCalledTimes(2);
  });
});
