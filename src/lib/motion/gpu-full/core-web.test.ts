import { describe, expect, it } from 'vitest';
import { BlendMode } from '../blend';
import { ItemKind, type GroupItem, type ImageItem, type LayerItem } from './display-list';
import { GL_PICTURE_SIDE, glPictureSize, pictureKey, wantedPictures, warmCore } from './core-web';

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

const image = { kind: ItemKind.Image, clip: 'photo', src: 'a.png', video: false } as ImageItem;
const group: GroupItem = { kind: ItemKind.Group, clip: 'ph', items: [layer, image], opacity: 1, matrix: [1, 0, 0, 1, 0, 0], blur: 0, blend: BlendMode.Normal };

describe('the pictures the core needs', () => {
  it('include the layers and images inside a group', () => {
    expect(wantedPictures([group])).toEqual([layer, image]);
  });

  it('are keyed by a layer source and by an image clip', () => {
    expect([layer, image].map(pictureKey)).toEqual(['ph:0', 'photo']);
  });
});

describe('warming the core', () => {
  it('loads and compiles the wasm once, however many canvases ask', () => {
    const first = warmCore();
    first.catch(() => undefined);
    expect(warmCore()).toBe(first);
  });
});
