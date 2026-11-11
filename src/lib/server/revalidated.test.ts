import { describe, expect, it, vi } from 'vitest';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

const packed = vi.hoisted(() => ({ count: 0 }));
vi.mock('node:zlib', async (real) => {
  const zlib = await real<typeof import('node:zlib')>();
  return { ...zlib, brotliCompressSync: (...a: Parameters<typeof zlib.brotliCompressSync>) => (packed.count++, zlib.brotliCompressSync(...a)) };
});

const { revalidated } = await import('./revalidated');

const body = JSON.stringify({ frames: { a: 'x'.repeat(10_000) } });
const ask = (headers: Record<string, string>) => new Request('http://x/sources', { headers });

describe('a frame source response', () => {
  it('is brotli-compressed when the browser accepts it (the node server sent 11 MB of plain JSON on open)', async () => {
    const res = revalidated(ask({ 'accept-encoding': 'gzip, deflate, br' }), body);

    expect(res.headers.get('content-encoding')).toBe('br');
    expect(brotliDecompressSync(Buffer.from(await res.arrayBuffer())).toString()).toBe(body);
  });

  it('falls back to gzip', async () => {
    const res = revalidated(ask({ 'accept-encoding': 'gzip' }), body);

    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(gunzipSync(Buffer.from(await res.arrayBuffer())).toString()).toBe(body);
  });

  it('stays plain when nothing is accepted, and keeps the same tag either way', async () => {
    const plain = revalidated(ask({}), body);
    const packed = revalidated(ask({ 'accept-encoding': 'br' }), body);

    expect(await plain.text()).toBe(body);
    expect(plain.headers.get('etag')).toBe(packed.headers.get('etag'));
    expect(packed.headers.get('vary')).toBe('accept-encoding');
  });

  it('compresses a body once, then serves the packed bytes again while the tag holds', async () => {
    const same = JSON.stringify({ frames: { b: 'y'.repeat(10_000) } });
    const before = packed.count;

    const first = revalidated(ask({ 'accept-encoding': 'br' }), same);
    const again = revalidated(ask({ 'accept-encoding': 'br' }), same);

    expect(packed.count - before).toBe(1);
    expect(Buffer.from(await again.arrayBuffer())).toEqual(Buffer.from(await first.arrayBuffer()));
  });
});
