import { describe, expect, it, vi } from 'vitest';
import { hostAssets } from '$lib/server/motion/embed-assets';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_SUPABASE_URL: 'https://sb.test' } }));

const { GET } = await import('./+server');

const NODE = '6f1c2a8e-0b7d-4f1e-9a3c-2d5e8f7a1b40';
const BYTES = Buffer.alloc(4096, 7);
const PAGE = `<html>data:audio/mpeg;base64,${BYTES.toString('base64')}</html>`;
const HASH = hostAssets(PAGE, '').match(/\/([0-9a-f]+)/)?.[1] ?? '';

async function asset(hash: string, range?: string) {
  const fetch = async () => new Response(PAGE);
  const request = new Request('https://oh.feega.app/', { headers: range ? { range } : {} });
  return GET({ params: { id: NODE, hash }, fetch, request } as unknown as Parameters<typeof GET>[0]);
}

describe('/e/[id]/a/[hash]', () => {
  it('serves an inlined asset as its own immutable, cross-origin file', async () => {
    const res = await asset(HASH);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(Buffer.from(await res.arrayBuffer()).equals(BYTES)).toBe(true);
  });

  it('answers a byte range, which Safari needs to play audio', async () => {
    const res = await asset(HASH, 'bytes=0-99');

    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe(`bytes 0-99/${BYTES.length}`);
    expect((await res.arrayBuffer()).byteLength).toBe(100);
  });

  it('an unknown asset is a 404', async () => {
    await expect(asset('feedface')).rejects.toMatchObject({ status: 404 });
  });
});
