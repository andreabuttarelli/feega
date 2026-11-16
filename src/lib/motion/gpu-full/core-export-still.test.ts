import { describe, expect, it, vi } from 'vitest';
import { FullBackend } from '@feega/motion-core/motion/gpu-full/backends';

const made: { side?: number; atlas?: number } = {};

vi.mock('@feega/motion-core/motion/gpu-full/backends', async (real) => ({
  ...(await real<object>()),
  BACKENDS: { core: async (_canvas: unknown, _w: number, _h: number, side?: number) => ((made.side = side), { draw: () => [], dispose: () => {}, setImageAtlas: (atlas: number) => (made.atlas = atlas) }) }
}));
vi.mock('@feega/motion-core/motion/gpu-full/media', () => ({ createMedia: () => ({ ready: async () => {}, pictures: () => null, dispose: () => {} }) }));
vi.mock('$lib/motion/gpu/shared-frames', () => ({ originalFrames: () => null }));

const { stillRaster } = await import('./core-export');

describe('a still raster for component previews', () => {
  it('holds pictures and its image atlas inside the device budget, so a phone preview cannot grow a 256 MB atlas', async () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });

    await stillRaster(FullBackend.Core, 512, { pictureSide: 1024, atlasSide: 4096 });

    expect(made).toEqual({ side: 1024, atlas: 4096 });
  });
});
