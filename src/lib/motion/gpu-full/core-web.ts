import { ItemKind, type DisplayList, type ImageItem } from './display-list';
import type { Picture, Pictures, Raster } from './raster';

const CORE_URL = '/gpu-core/gpu_core.js';

type Attached = { draw: (list: string) => string; picture: (clip: string, source: unknown, width: number, height: number) => void; free: () => void };
type CoreModule = { default: () => Promise<unknown>; WebCore: { attach: (canvas: HTMLCanvasElement, width: number, height: number) => Promise<Attached> } };

const NO_PICTURES: Pictures = () => null;

const moving = (picture: Picture) => typeof HTMLVideoElement !== 'undefined' && picture.source instanceof HTMLVideoElement;

export async function createCore(canvas: HTMLCanvasElement, width: number, height: number): Promise<Raster> {
  if (!('gpu' in navigator)) {
    throw new Error('webgpu unavailable');
  }
  const core = (await import(/* @vite-ignore */ CORE_URL)) as CoreModule;
  await core.default();
  const attached = await core.WebCore.attach(canvas, width, height);
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
      for (const item of list.items) {
        if (item.kind === ItemKind.Image) {
          upload(item, pictures);
        }
      }
      attached.draw(JSON.stringify(list));
    },
    dispose: () => attached.free()
  };
}
