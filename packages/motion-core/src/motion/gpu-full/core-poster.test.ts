import { describe, expect, it, vi } from 'vitest';
import { rasterOf, type Attached } from './core-web';

const SIDE = 8;

describe('reading a poster back from the core', () => {
  it('wraps the bytes the core returned instead of copying them', async () => {
    vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
    const bytes = new Uint8Array(SIDE * SIDE * 4);
    const attached = { poster: async () => bytes } as unknown as Attached;

    const image = await rasterOf(attached).poster!('g', { width: SIDE, height: SIDE }, 1);
    vi.unstubAllGlobals();

    expect(image.data.buffer).toBe(bytes.buffer);
  });
});
