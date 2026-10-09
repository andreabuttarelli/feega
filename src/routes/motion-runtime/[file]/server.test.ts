import { describe, expect, it } from 'vitest';
import { Chunk, chunkCode, chunkUrl } from '$lib/motion/hyperframes/runtime-chunks';

const { GET } = await import('./+server');

const fileOf = (chunk: Chunk) => chunkUrl('', chunk).split('/').pop()!;
const open = (file: string) => GET({ params: { file } } as unknown as Parameters<typeof GET>[0]);

describe('/motion-runtime/[file]', () => {
  it('serves a runtime file as an immutable script any embed can load', async () => {
    const res = await open(fileOf(Chunk.Particles));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(await res.text()).toBe(chunkCode(Chunk.Particles));
  });

  it('a file from another build is a 404, never someone else’s code', async () => {
    expect(() => open('particles.0000000000000000.js')).toThrow(expect.objectContaining({ status: 404 }));
  });
});
