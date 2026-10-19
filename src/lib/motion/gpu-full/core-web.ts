import { CoverKind, ItemKind, type DisplayList, type ImageItem, type Item, type LayerItem } from './display-list';
import type { Picture, Pictures, Raster } from './raster';
import type { Affine } from '../affine';
import type { Rgba } from './rgba';

const CORE_URL = '/gpu-core/gpu_core.js';

type Size = { width: number; height: number };
type Attached = { draw: (list: string) => string; picture: (clip: string, source: unknown, width: number, height: number) => void; put_group: (key: string, list: string) => void; drop_group: (key: string) => void; append_group: (key: string, list: string) => void; cache_pending: () => boolean; cache_bytes: () => number; free: () => void };

export type Use = { kind: 'use'; clip: string; group: string; matrix: Affine; cache?: boolean };
export type Screen = { width: number; height: number; background: Rgba | null; items: (Item | Use)[] };
export type CoreRaster = Omit<Raster, 'draw'> & { draw: (list: DisplayList, pictures?: Pictures) => string[]; putGroup: (key: string, list: DisplayList, pictures?: Pictures) => void; appendGroup: (key: string, list: DisplayList, pictures?: Pictures) => void; dropGroup: (key: string) => void; drawScreen: (screen: Screen, pictures?: Pictures) => boolean; upload: (list: DisplayList, pictures: Pictures) => void; cacheBytes: () => number };
type Attach<T> = (canvas: HTMLCanvasElement, width: number, height: number) => T;
type CoreModule = { default: () => Promise<unknown>; WebCore: { attach: Attach<Promise<Attached>> }; WebGlCore: { attach: Attach<Attached> } };

type PictureItem = ImageItem | LayerItem;

const NO_PICTURES: Pictures = () => null;

const coverPicture = (src: string) => ({ kind: ItemKind.Image, clip: src, src, video: false }) as ImageItem;

export const pictureKey = (item: PictureItem): string => (item.kind === ItemKind.Layer ? item.source : item.clip);

export function wantedPictures(items: Item[]): PictureItem[] {
  return items.flatMap((i) => [
    ...(i.kind === ItemKind.Image || i.kind === ItemKind.Layer ? [i] : []),
    ...(i.kind === ItemKind.Group ? wantedPictures(i.items) : []),
    ...wantedPictures(i.matte?.items ?? []),
    ...(i.masks ?? []).flatMap((m) => (m.cover.kind === CoverKind.Picture ? [coverPicture(m.cover.src)] : []))
  ]);
}

const moving = (picture: Picture) => (typeof HTMLVideoElement !== 'undefined' && picture.source instanceof HTMLVideoElement) || (typeof HTMLCanvasElement !== 'undefined' && picture.source instanceof HTMLCanvasElement);

let loading: Promise<CoreModule> | null = null;

async function loadCore(): Promise<CoreModule> {
  const core = (await import(/* @vite-ignore */ CORE_URL)) as CoreModule;
  await core.default();
  return core;
}

export function warmCore(): Promise<CoreModule> {
  loading ??= loadCore().catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

function rasterOf(attached: Attached): CoreRaster {
  const uploaded = new Map<string, Picture['source']>();
  const stills = new Map<string, HTMLCanvasElement>();

  function still(clip: string, picture: Picture): HTMLCanvasElement {
    const canvas = stills.get(clip) ?? stills.set(clip, document.createElement('canvas')).get(clip)!;
    canvas.width = picture.size.width;
    canvas.height = picture.size.height;
    canvas.getContext('2d')!.drawImage(picture.source as CanvasImageSource, 0, 0);
    return canvas;
  }

  function upload(item: PictureItem, pictures: Pictures) {
    const picture = pictures(item);
    if (!picture) {
      return;
    }
    const key = pictureKey(item);
    if (uploaded.get(key) === picture.source && !moving(picture)) {
      return;
    }
    attached.picture(key, moving(picture) ? still(key, picture) : picture.source, picture.size.width, picture.size.height);
    uploaded.set(key, picture.source);
  }

  const drawn = (items: Item[]) => items.filter((i): i is Item => (i as Item | Use).kind !== 'use');

  return {
    draw: (list: DisplayList, pictures = NO_PICTURES) => {
      wantedPictures(list.items).forEach((item) => upload(item, pictures));
      return attached.draw(JSON.stringify(list)).split('\n').filter(Boolean);
    },
    putGroup: (key: string, list: DisplayList, pictures = NO_PICTURES) => {
      wantedPictures(list.items).forEach((item) => upload(item, pictures));
      attached.put_group(key, JSON.stringify(list));
    },
    appendGroup: (key: string, list: DisplayList, pictures = NO_PICTURES) => {
      wantedPictures(list.items).forEach((item) => upload(item, pictures));
      attached.append_group(key, JSON.stringify(list));
    },
    dropGroup: (key: string) => attached.drop_group(key),
    upload: (list: DisplayList, pictures: Pictures) => wantedPictures(list.items).forEach((item) => upload(item, pictures)),
    drawScreen: (screen: Screen, pictures = NO_PICTURES) => {
      wantedPictures(drawn(screen.items as Item[])).forEach((item) => upload(item, pictures));
      attached.draw(JSON.stringify(screen));
      return attached.cache_pending();
    },
    cacheBytes: () => attached.cache_bytes(),
    dispose: () => attached.free()
  };
}

export async function createCore(canvas: HTMLCanvasElement, width: number, height: number): Promise<CoreRaster> {
  if (!('gpu' in navigator)) {
    throw new Error('webgpu unavailable');
  }
  const core = await warmCore();
  return rasterOf(await core.WebCore.attach(canvas, width, height));
}

export const GL_PICTURE_SIDE = 2048;

export function glPictureSize(size: Size): Size {
  const scale = Math.min(1, GL_PICTURE_SIDE / Math.max(size.width, size.height));
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}

function fitted(source: unknown, size: Size): { source: unknown; size: Size } {
  const fit = glPictureSize(size);
  if (fit.width === size.width && fit.height === size.height) {
    return { source, size };
  }
  const canvas = document.createElement('canvas');
  canvas.width = fit.width;
  canvas.height = fit.height;
  canvas.getContext('2d')!.drawImage(source as CanvasImageSource, 0, 0, fit.width, fit.height);
  return { source: canvas, size: fit };
}

const GL_CONTEXT = { antialias: false, depth: true };

export async function createCoreGl(canvas: HTMLCanvasElement, width: number, height: number): Promise<CoreRaster> {
  if (!canvas.getContext('webgl2', GL_CONTEXT)) {
    throw new Error('webgl2 unavailable');
  }
  const core = await warmCore();
  const attached = core.WebGlCore.attach(canvas, width, height);
  const picture = attached.picture.bind(attached);
  attached.picture = (clip, source, w, h) => {
    const fit = fitted(source, { width: w, height: h });
    picture(clip, fit.source, fit.size.width, fit.size.height);
  };
  return rasterOf(attached);
}
