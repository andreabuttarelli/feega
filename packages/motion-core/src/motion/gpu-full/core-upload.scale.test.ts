import { describe, expect, it, vi } from 'vitest';
import { ItemKind, type DisplayList, type ImageItem } from './display-list';
import { rasterOf } from './core-web';

const SIZE = 2000;
const NO_BAND = Infinity;

const image = (clip: string) => ({ kind: ItemKind.Image, clip }) as unknown as ImageItem;
const noop = new Proxy({}, { get: () => () => undefined }) as never;

describe('uploading the pictures of a display list', () => {
  it('drains the queue without searching it once per picture', () => {
    const list = { items: Array.from({ length: SIZE }, (_, i) => image(`c${i}`)) } as unknown as DisplayList;
    const pictures = () => ({ source: {}, size: { width: 4, height: 4 } }) as never;
    const raster = rasterOf(noop);
    const searches = vi.spyOn(Array.prototype, 'indexOf');

    const drained = raster.upload(list, pictures, NO_BAND);
    const scans = searches.mock.calls.length;
    searches.mockRestore();

    expect(drained).toBe(true);
    expect(scans).toBe(0);
  });
});
