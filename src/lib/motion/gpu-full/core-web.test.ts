import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlendMode } from '@feega/motion-core/motion/blend';
import { ItemKind, type DisplayList, type GroupItem, type ImageItem, type Item, type LayerItem } from '@feega/motion-core/motion/gpu-full/display-list';
import type { Pictures } from '@feega/motion-core/motion/gpu-full/raster';
import { GL_PICTURE_SIDE, glPictureSize, pictureKey, pictureSize, wantedPictures, warmCore, rasterOf, overBytes } from '@feega/motion-core/motion/gpu-full/core-web';

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

describe('a group sent to the core', () => {
  it('carries a whole-pixel size, because the core reads it as an integer', () => {
    const sent: string[] = [];
    const attached = { put_group: (_key: string, json: string) => sent.push(json) } as unknown as Parameters<typeof rasterOf>[0];
    const list = { width: 886.5603019630531, height: 401.2, background: null, items: [] } as unknown as DisplayList;

    rasterOf(attached).putGroup('g', list);

    expect(JSON.parse(sent[0])).toMatchObject({ width: 887, height: 402 });
  });
});

describe('dropping a group', () => {
  const image = (clip: string) => ({ kind: ItemKind.Image, clip, src: clip, video: false }) as unknown as Item;
  const listOf = (...clips: string[]) => ({ width: 1, height: 1, background: null, items: clips.map(image) }) as DisplayList;
  const source = {};
  const pictures = () => ({ source, size: { width: 1, height: 1 } }) as unknown as ReturnType<Pictures>;

  function wired() {
    const forgot: string[] = [];
    const sent: string[] = [];
    const attached = { picture: (clip: string) => sent.push(clip), put_group: () => undefined, drop_group: () => undefined, forget_picture: (clip: string) => forgot.push(clip) } as unknown as Parameters<typeof rasterOf>[0];
    return { raster: rasterOf(attached), forgot, sent };
  }

  it('frees the pictures no other group still shows', () => {
    const { raster, forgot } = wired();
    raster.putGroup('g1', listOf('a', 'b'), pictures);
    raster.putGroup('g2', listOf('b'), pictures);

    raster.dropGroup('g1');

    expect(forgot).toEqual(['a']);
  });

  it('uploads a freed picture again when its group comes back', () => {
    const { raster, sent } = wired();
    const list = listOf('a');
    raster.putGroup('g', list, pictures);
    raster.dropGroup('g');
    raster.putGroup('g', list);

    expect(raster.upload(list, pictures, 1)).toBe(true);
    expect(sent).toEqual(['a', 'a']);
  });
});

describe('pictureSize', () => {
  it('fits a picture inside the side the device budget allows', () => {
    expect(pictureSize(1024)({ width: 4000, height: 2000 })).toEqual({ width: 1024, height: 512 });
  });
});

describe('uploading a decoded still', () => {
  class FakeBitmap {
    constructor(
      readonly width: number,
      readonly height: number
    ) {}
    close() {}
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const one = (clip: string) => ({ width: 1, height: 1, background: null, items: [{ kind: ItemKind.Image, clip, src: clip, video: false }] }) as unknown as DisplayList;

  afterEach(() => vi.unstubAllGlobals());

  function wired() {
    const rows: [number, number][] = [];
    const whole: unknown[] = [];
    const attached = {
      picture: (_clip: string, source: unknown) => whole.push(source),
      picture_rows: (_clip: string, _source: unknown, _width: number, height: number, top: number, count: number) => (rows.push([top, count]), top + count >= height)
    } as unknown as Parameters<typeof rasterOf>[0];
    return { raster: rasterOf(attached), rows, whole };
  }

  it('sends a large picture a band of rows at a time and calls it in only with the last band', async () => {
    vi.stubGlobal('ImageBitmap', FakeBitmap);
    vi.stubGlobal('createImageBitmap', vi.fn());
    const big = new FakeBitmap(4096, 3072);
    const pictures = () => ({ source: big, size: { width: 4096, height: 3072 } }) as unknown as ReturnType<Pictures>;
    const { raster, rows } = wired();
    const list = one('big');

    const done: boolean[] = [];
    for (let call = 0; call < 6 && !done.at(-1); call++) {
      done.push(raster.upload(list, pictures, 1));
      await settle();
    }

    expect(done.at(-1)).toBe(true);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.every(([, count]) => count * 4096 <= 1 << 21)).toBe(true);
    expect(rows.map(([top]) => top)).toEqual(rows.map((_, i) => i * rows[0][1]));
    expect(done.slice(0, -1).every((d) => !d)).toBe(true);
  });

  it('sends a bitmap already at its size as it is, without copying it again on the main thread', async () => {
    vi.stubGlobal('ImageBitmap', FakeBitmap);
    const copy = vi.fn();
    vi.stubGlobal('createImageBitmap', copy);
    const small = new FakeBitmap(64, 64);
    const pictures = () => ({ source: small, size: { width: 64, height: 64 } }) as unknown as ReturnType<Pictures>;
    const { raster, whole } = wired();

    expect(raster.upload(one('small'), pictures, 1)).toBe(true);
    expect(copy).not.toHaveBeenCalled();
    expect(whole).toEqual([small]);
  });
});

describe('the wasm core', () => {
  const wasm = () => {
    const got: unknown[][] = [];
    const core = { put_group: (...a: unknown[]) => got.push(a), append_group: (...a: unknown[]) => got.push(a), patch_group: (...a: unknown[]) => got.push(a), set_overlay: (...a: unknown[]) => got.push(a), set_live_overlay: (...a: unknown[]) => got.push(a), patch_uses: (...a: unknown[]) => got.push(a), draw: (...a: unknown[]) => (got.push(a), ''), drop_group: (...a: unknown[]) => got.push(a) };
    return { core, got };
  };
  const text = (bytes: unknown) => new TextDecoder().decode(bytes as Uint8Array);

  it('takes every display list, splice, patch and overlay as utf-8 bytes, not a string copied char by char', () => {
    const { core, got } = wasm();
    const attached = overBytes(core);

    attached.put_group('g', '{"a":"é"}');
    attached.append_group('g', '[1]');
    attached.patch_group('g', 'h', '{"head":0}');
    attached.set_overlay('[2]');
    attached.set_live_overlay('[3]');
    attached.patch_uses('{"put":[]}');
    attached.draw('{}');

    expect(got.map((a) => [...a.slice(0, -1), text(a.at(-1))])).toEqual([['g', '{"a":"é"}'], ['g', '[1]'], ['g', 'h', '{"head":0}'], ['[2]'], ['[3]'], ['{"put":[]}'], ['{}']]);
  });

  it('passes a key alone through untouched', () => {
    const { core, got } = wasm();

    overBytes(core).drop_group('g');

    expect(got).toEqual([['g']]);
  });
});
