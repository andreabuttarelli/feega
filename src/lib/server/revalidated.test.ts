import { describe, expect, it } from 'vitest';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { revalidated } from './revalidated';

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
});
