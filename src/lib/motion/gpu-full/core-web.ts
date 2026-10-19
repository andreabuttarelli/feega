import { CoverKind, ItemKind, type DisplayList, type ImageItem, type Item } from './display-list';
import type { Picture, Pictures, Raster } from './raster';

const CORE_URL = '/gpu-core/gpu_core.js';

type Attached = { draw: (list: string) => string; picture: (clip: string, source: unknown, width: number, height: number) => void; free: () => void };
type Attach<T> = (canvas: HTMLCanvasElement, width: number, height: number) => T;
type CoreModule = { default: () => Promise<unknown>; WebCore: { attach: Attach<Promise<Attached>> }; WebGlCore: { attach: Attach<Attached> } };

const NO_PICTURES: Pictures = () => null;

const coverPicture = (src: string) => ({ kind: ItemKind.Image, clip: src, src, video: false }) as ImageItem;

function wanted(items: Item[]): ImageItem[] {
  return items.flatMap((i) => [
    ...(i.kind === ItemKind.Image ? [i] : []),
    ...wanted(i.matte?.items ?? []),
    ...(i.masks ?? []).flatMap((m) => (m.cover.kind === CoverKind.Picture ? [coverPicture(m.cover.src)] : []))
  ]);
}

const moving = (picture: Picture) => typeof HTMLVideoElement !== 'undefined' && picture.source instanceof HTMLVideoElement;

async function coreModule(): Promise<CoreModule> {
  const core = (await import(/* @vite-ignore */ CORE_URL)) as CoreModule;
  await core.default();
  return core;
}

function rasterOf(attached: Attached): Raster {
  const uploaded = new Map<string, Picture['source']>();

  function upload(item: ImageItem, pictures: Pictures) {
    const picture = pictures(item);
    if (!picture) {
      return;
    }
    if (uploaded.get(item.clip) === picture.source && !moving(picture)) {
      return;
    }
    attached.picture(item.clip, picture.source, picture.size.width, picture.size.height);
    uploaded.set(item.clip, picture.source);
  }

  return {
    draw: (list: DisplayList, pictures = NO_PICTURES) => {
      wanted(list.items).forEach((item) => upload(item, pictures));
      attached.draw(JSON.stringify(list));
    },
    dispose: () => attached.free()
  };
}

export async function createCore(canvas: HTMLCanvasElement, width: number, height: number): Promise<Raster> {
  if (!('gpu' in navigator)) {
    throw new Error('webgpu unavailable');
  }
  const core = await coreModule();
  return rasterOf(await core.WebCore.attach(canvas, width, height));
}

export async function createCoreGl(canvas: HTMLCanvasElement, width: number, height: number): Promise<Raster> {
  const core = await coreModule();
  return rasterOf(core.WebGlCore.attach(canvas, width, height));
}
