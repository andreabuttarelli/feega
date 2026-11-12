import { describe, expect, it } from 'vitest';
import type { ImageItem } from '@feega/motion-core/motion/gpu-full/display-list';
import type { Picture } from '@feega/motion-core/motion/gpu-full/raster';
import { customPictures } from './custom-pictures';

const item = { source: 'clip:0' } as unknown as ImageItem;
const pictureAt = (time: number): Picture => ({ source: { time } as unknown as Picture['source'], size: { width: 1, height: 1 } });
const timeOf = (picture: Picture | null) => (picture?.source as unknown as { time: number } | undefined)?.time;

describe('customPictures', () => {
  it('a canvas redrawn every playback tick shows the newest read, not the poster read before it', () => {
    const pictures = customPictures();
    pictures.set('frame:poster', () => pictureAt(0.5));

    pictures.set('frame:live', () => pictureAt(0.1));
    expect(timeOf(pictures.of(item))).toBe(0.1);

    pictures.set('frame:live', () => pictureAt(0.9));
    expect(timeOf(pictures.of(item))).toBe(0.9);
  });

  it('falls back to the poster once playback stops', () => {
    const pictures = customPictures();
    pictures.set('frame:poster', () => pictureAt(0.5));
    pictures.set('frame:live', () => pictureAt(0.9));

    pictures.drop('frame:live');

    expect(timeOf(pictures.of(item))).toBe(0.5);
  });

  it('answers null when no read owns the item', () => {
    const pictures = customPictures();
    pictures.set('frame:poster', () => null);

    expect(pictures.of(item)).toBeNull();
  });
});
