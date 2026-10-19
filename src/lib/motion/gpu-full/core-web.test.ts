import { describe, expect, it } from 'vitest';
import { BlendMode } from '../blend';
import { ItemKind, type DisplayList, type Item, type LayerItem } from './display-list';
import type { Pictures } from './raster';
import { GL_PICTURE_SIDE, forCore, glPictureSize, rasterOf } from './core-web';

describe('glPictureSize', () => {
  it('keeps a picture that fits the WebGL atlas as it is', () => {
    expect(glPictureSize({ width: 1080, height: 720 })).toEqual({ width: 1080, height: 720 });
  });

  it('shrinks a picture past the atlas side to fit it, keeping its aspect', () => {
    expect(glPictureSize({ width: 5000, height: 2500 })).toEqual({ width: GL_PICTURE_SIDE, height: GL_PICTURE_SIDE / 2 });
    expect(glPictureSize({ width: 3574, height: 3575 })).toEqual({ width: 2047, height: GL_PICTURE_SIDE });
  });
});

const layer: LayerItem = { kind: ItemKind.Layer, clip: 'ph', source: 'ph:0', size: { width: 40, height: 20 }, opacity: 0.5, matrix: [1, 0, 0, 1, 3, 4], blur: 0, blend: BlendMode.Normal };

describe('the core draws a layer', () => {
  it('as a picture keyed by its source, filling its box', () => {
    expect(forCore(layer)).toMatchObject({ kind: ItemKind.Image, clip: 'ph:0', src: 'ph:0', size: { width: 40, height: 20 }, fit: 'fill', clipped: true, inner: [1, 0, 0, 1, 0, 0], opacity: 0.5, matrix: [1, 0, 0, 1, 3, 4] });
  });
});

describe('uploading a group\'s pictures', () => {
  it('sends at most the given number per call and says when all are in', () => {
    const sent: string[] = [];
    const attached = { picture: (clip: string) => sent.push(clip) } as unknown as Parameters<typeof rasterOf>[0];
    const image = (clip: string) => ({ kind: ItemKind.Image, clip, src: clip, video: false }) as unknown as Item;
    const list = { width: 1, height: 1, background: null, items: [image('a'), image('b')] } as DisplayList;
    const source = {};
    const pictures = () => ({ source, size: { width: 1, height: 1 } }) as unknown as ReturnType<Pictures>;
    const raster = rasterOf(attached);

    expect(raster.upload(list, pictures, 1)).toBe(false);
    expect(raster.upload(list, pictures, 1)).toBe(true);
    expect(sent).toEqual(['a', 'b']);
  });
});
