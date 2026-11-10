import { CoverKind, ItemKind, type DisplayList, type ImageItem, type Item, type LayerItem } from './display-list';
import type { Picture, Pictures, Raster } from './raster';
import type { Affine } from '../affine';
import type { Outcome } from './core-outcome';
import { OverlayPart } from './core-overlay';
import { listPack, listWire, spliceWire, type Splice } from './wire';
import { inlineCore, unzipBase64 } from './inline-core';
import { releaseOnDispose, type GpuSurface } from './gpu-release';

const CORE_URL = '/gpu-core/gpu_core.js';

type Size = { width: number; height: number };
export type Attached = { draw: (list: string) => string; set_camera: (x: number, y: number, zoom: number) => void; patch_uses: (patch: string) => void; set_overlay: (items: string) => void; set_live_overlay: (items: string) => void; frame: (now: number) => string; picture: (clip: string, source: unknown, width: number, height: number) => void; picture_rows?: (clip: string, source: unknown, width: number, height: number, top: number, rows: number) => boolean; put_group: (key: string, list: string) => void; patch_group: (from: string, to: string, splice: string) => boolean; drop_group: (key: string) => void; append_group: (key: string, list: string) => void; put_group_packed?: (key: string, list: string, floats: Float64Array, ends: Uint32Array) => void; append_group_packed?: (key: string, list: string, floats: Float64Array, ends: Uint32Array) => void; cache_pending: () => boolean; cache_bytes: () => number; scratch_bytes?: () => number; forget_picture: (clip: string) => void; picture_bytes: () => number; lost: () => boolean; busy?: () => boolean; set_motion?: (motion: CoreMotion) => void; set_budget?: (bytes: number) => void; set_tiles?: (on: boolean) => void; set_tile_budget?: (bytes: number) => void; poster?: (group: string, width: number, height: number, scale: number) => Promise<Uint8Array>; free: () => void };

export enum CoreMotion {
  Still = 0,
  Gesture = 1
}

export type Use = { kind: 'use'; clip: string; group: string; matrix: Affine; cache?: boolean; hold?: boolean };
export type UsePatch = { put: Use[]; drop: string[]; order?: string[] };
export type Painted = { outcome: Outcome; pending: boolean; skipped: string[] };
export type CoreRaster = Omit<Raster, 'draw'> & { draw: (list: DisplayList, pictures?: Pictures) => string[]; putGroup: (key: string, list: DisplayList, pictures?: Pictures) => void; appendGroup: (key: string, list: DisplayList, pictures?: Pictures) => void; patchGroup: (from: string, to: string, splice: Splice, pictures?: Pictures) => boolean; dropGroup: (key: string) => void; setCamera: (x: number, y: number, zoom: number) => void; patchUses: (patch: UsePatch) => void; setOverlay: (part: OverlayPart, items: readonly Item[]) => void; frame: (now: number) => Painted; upload: (list: DisplayList, pictures: Pictures, most: number) => boolean; cacheBytes: () => number; pictureBytes: () => number; scratchBytes?: () => number; wasmBytes?: () => number; lost: () => boolean; busy?: () => boolean; setMotion?: (motion: CoreMotion) => void; setBudget?: (bytes: number) => void; setTiles?: (on: boolean) => void; setTileBudget?: (bytes: number) => void; poster?: (group: string, size: { width: number; height: number }, scale: number) => Promise<ImageData>; behindPage?: boolean };
type Attach<T> = (canvas: HTMLCanvasElement, width: number, height: number) => T;
type CoreModule = { default: () => Promise<unknown>; WebCore: { attach: Attach<Promise<object>> }; WebGlCore: { attach: Attach<object> } };

type PictureItem = ImageItem | LayerItem;

const OVERLAY_SETTERS: Record<OverlayPart, (core: Attached, items: string) => void> = {
  [OverlayPart.Fixed]: (core, items) => core.set_overlay(items),
  [OverlayPart.Live]: (core, items) => core.set_live_overlay(items)
};

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

const BAND_PIXELS = 1 << 21;

const asBitmap = (source: unknown): ImageBitmap | null => (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap ? source : null);

const moving = (picture: Picture) => (typeof HTMLVideoElement !== 'undefined' && picture.source instanceof HTMLVideoElement) || (typeof HTMLCanvasElement !== 'undefined' && picture.source instanceof HTMLCanvasElement);

let loading: Promise<CoreModule> | null = null;
let instance = 0;
let wasmMemory: WebAssembly.Memory | null = null;

const kept = (exports: unknown) => {
  const memory = (exports as { memory?: unknown } | undefined)?.memory;
  if (memory instanceof WebAssembly.Memory) {
    wasmMemory = memory;
  }
};

async function loadInlineCore(inline: NonNullable<ReturnType<typeof inlineCore>>): Promise<CoreModule> {
  const core = (await import(/* @vite-ignore */ URL.createObjectURL(new Blob([inline.js], { type: 'text/javascript' })))) as CoreModule & { default: (init?: { module_or_path: Uint8Array }) => Promise<unknown> };
  kept(await core.default({ module_or_path: await unzipBase64(inline.wasm) }));
  return core;
}

async function loadCore(): Promise<CoreModule> {
  const inline = inlineCore();
  if (inline) {
    return loadInlineCore(inline);
  }
  const url = new URL(CORE_URL, import.meta.url);
  if (instance) {
    url.searchParams.set('instance', String(instance));
  }
  const core = (await import(/* @vite-ignore */ url.href)) as CoreModule;
  kept(await core.default());
  return core;
}

export function dropCore(): void {
  loading = null;
  instance++;
}

export function warmCore(): Promise<CoreModule> {
  loading ??= loadCore().catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

const utf8 = new TextEncoder();
const WIRED_PACKED = new Set(['put_group_packed', 'append_group_packed']);
const WIRED_LAST = new Set(['draw', 'patch_uses', 'set_overlay', 'set_live_overlay', 'put_group', 'append_group', 'patch_group']);

export function overBytes(core: object): Attached {
  return new Proxy(core, {
    get(target, name) {
      const member = Reflect.get(target, name) as unknown;
      if (typeof member !== 'function') {
        return member;
      }
      if (typeof name === 'string' && WIRED_PACKED.has(name)) {
        return (key: string, list: string, floats: Float64Array, ends: Uint32Array) => member.apply(target, [key, utf8.encode(list), floats, ends]);
      }
      if (typeof name !== 'string' || !WIRED_LAST.has(name)) {
        return member.bind(target);
      }
      return (...args: unknown[]) => member.apply(target, [...args.slice(0, -1), utf8.encode(args.at(-1) as string)]);
    }
  }) as Attached;
}

type Fit = (size: Size) => Size;

const asIs: Fit = (size) => size;

export function rasterOf(attached: Attached, fit: Fit = asIs): CoreRaster {
  const decoded = new WeakMap<object, ImageBitmap | null | undefined>();
  let queues = new WeakMap<DisplayList, PictureItem[]>();
  const uploaded = new Map<string, Picture['source']>();
  const stills = new Map<string, HTMLCanvasElement>();
  const shown = new Map<string, Set<string>>();
  const arriving = new Map<string, { source: unknown; top: number }>();

  function show(group: string, items: Item[], from = group) {
    shown.set(group, new Set([...(shown.get(from) ?? []), ...wantedPictures(items).map(pictureKey)]));
  }

  function forget(key: string) {
    const source = uploaded.get(key);
    if (source) {
      decoded.get(source as object)?.close();
      decoded.delete(source as object);
    }
    uploaded.delete(key);
    stills.delete(key);
    arriving.delete(key);
    attached.forget_picture(key);
  }

  function hide(group: string) {
    const gone = shown.get(group);
    shown.delete(group);
    const still = new Set([...shown.values()].flatMap((keys) => [...keys]));
    const freed = [...(gone ?? [])].filter((k) => !still.has(k));
    if (!freed.length) {
      return;
    }
    freed.forEach(forget);
    queues = new WeakMap();
  }

  function still(clip: string, picture: Picture): HTMLCanvasElement {
    const canvas = stills.get(clip) ?? stills.set(clip, document.createElement('canvas')).get(clip)!;
    canvas.width = picture.size.width;
    canvas.height = picture.size.height;
    canvas.getContext('2d')!.drawImage(picture.source as CanvasImageSource, 0, 0);
    return canvas;
  }

  function upload(item: PictureItem, pictures: Pictures): boolean {
    const picture = pictures(item);
    if (!picture) {
      return false;
    }
    const key = pictureKey(item);
    if (uploaded.get(key) === picture.source && !moving(picture)) {
      return false;
    }
    attached.picture(key, moving(picture) ? still(key, picture) : picture.source, picture.size.width, picture.size.height);
    uploaded.set(key, picture.source);
    return true;
  }

  function sendRows(key: string, bitmap: ImageBitmap): boolean {
    const { width, height } = bitmap;
    const rows = Math.max(1, Math.floor(BAND_PIXELS / width));
    if (!attached.picture_rows || rows >= height) {
      attached.picture(key, bitmap, width, height);
      return true;
    }
    const going = arriving.get(key);
    const top = going?.source === bitmap ? going.top : 0;
    const done = attached.picture_rows(key, bitmap, width, height, top, rows);
    if (done) {
      arriving.delete(key);
    } else {
      arriving.set(key, { source: bitmap, top: top + rows });
    }
    return done;
  }

  function decodedOf(picture: Picture): ImageBitmap | null | undefined {
    if (typeof createImageBitmap !== 'function') {
      return undefined;
    }
    const size = fit(picture.size);
    const own = asBitmap(picture.source);
    if (own && own.width === size.width && own.height === size.height) {
      return own;
    }
    const source = picture.source as object;
    if (decoded.has(source)) {
      return decoded.get(source);
    }
    decoded.set(source, null);
    void createImageBitmap(picture.source as ImageBitmapSource, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' }).then(
      (bitmap) => decoded.set(source, bitmap),
      () => decoded.set(source, undefined)
    );
    return null;
  }

  const putList = (key: string, list: DisplayList) => {
    if (!attached.put_group_packed) {
      attached.put_group(key, listWire(list));
      return;
    }
    const pack = listPack(list);
    attached.put_group_packed(key, pack.json, pack.floats, pack.ends);
  };

  const appendList = (key: string, list: DisplayList) => {
    if (!attached.append_group_packed) {
      attached.append_group(key, listWire(list));
      return;
    }
    const pack = listPack(list);
    attached.append_group_packed(key, pack.json, pack.floats, pack.ends);
  };

  return {
    draw: (list: DisplayList, pictures = NO_PICTURES) => {
      wantedPictures(list.items).forEach((item) => upload(item, pictures));
      return attached.draw(listWire(list)).split('\n').filter(Boolean);
    },
    putGroup: (key: string, list: DisplayList, pictures = NO_PICTURES) => {
      wantedPictures(list.items).forEach((item) => upload(item, pictures));
      show(key, list.items, '');
      putList(key, list);
    },
    appendGroup: (key: string, list: DisplayList, pictures = NO_PICTURES) => {
      wantedPictures(list.items).forEach((item) => upload(item, pictures));
      show(key, list.items);
      appendList(key, list);
    },
    patchGroup: (from: string, to: string, splice: Splice, pictures = NO_PICTURES) => {
      wantedPictures(splice.items).forEach((item) => upload(item, pictures));
      show(to, splice.items, from);
      return attached.patch_group(from, to, spliceWire(splice));
    },
    dropGroup: (key: string) => {
      attached.drop_group(key);
      hide(key);
    },
    upload: (list: DisplayList, pictures: Pictures, most: number) => {
      const queue = queues.get(list) ?? queues.set(list, wantedPictures(list.items)).get(list)!;
      let sent = 0;
      for (const item of [...queue]) {
        if (sent >= most) {
          break;
        }
        const picture = pictures(item);
        const bitmap = picture && !moving(picture) ? decodedOf(picture) : undefined;
        if (bitmap === null) {
          continue;
        }
        const key = pictureKey(item);
        if (bitmap && uploaded.get(key) !== picture!.source) {
          sent++;
          if (!sendRows(key, bitmap)) {
            continue;
          }
          queue.splice(queue.indexOf(item), 1);
          uploaded.set(key, picture!.source);
          continue;
        }
        queue.splice(queue.indexOf(item), 1);
        sent += upload(item, pictures) ? 1 : 0;
      }
      return queue.length === 0;
    },
    setCamera: (x: number, y: number, zoom: number) => attached.set_camera(x, y, zoom),
    patchUses: (patch: UsePatch) => attached.patch_uses(JSON.stringify(patch)),
    setOverlay: (part: OverlayPart, items: readonly Item[]) => OVERLAY_SETTERS[part](attached, JSON.stringify(items)),
    frame: (now: number) => {
      const [outcome, ...skipped] = attached.frame(now).split('\n');
      return { outcome: outcome as Outcome, pending: attached.cache_pending(), skipped: skipped.filter(Boolean) };
    },
    ...(attached.poster ? { poster: (group: string, size: { width: number; height: number }, scale: number) => attached.poster!(group, size.width, size.height, scale).then((bytes) => new ImageData(new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength), size.width, size.height)) } : {}),
    cacheBytes: () => attached.cache_bytes(),
    pictureBytes: () => attached.picture_bytes(),
    scratchBytes: () => attached.scratch_bytes?.() ?? 0,
    wasmBytes: () => wasmMemory?.buffer.byteLength ?? 0,
    lost: () => attached.lost(),
    busy: () => attached.busy?.() ?? false,
    setMotion: (motion: CoreMotion) => attached.set_motion?.(motion),
    setTiles: (on: boolean) => attached.set_tiles?.(on),
    setTileBudget: (bytes: number) => attached.set_tile_budget?.(bytes),
    setBudget: (bytes: number) => attached.set_budget?.(bytes),
    dispose: () => attached.free()
  };
}

export const pictureSize =
  (side: number): Fit =>
  (size) => {
    const scale = Math.min(1, side / Math.max(size.width, size.height));
    return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
  };

export const GL_PICTURE_SIDE = 2048;

export const glPictureSize = pictureSize(GL_PICTURE_SIDE);

function fitted(source: unknown, size: Size, fitOf: Fit): { source: unknown; size: Size } {
  const fit = fitOf(size);
  if (fit.width === size.width && fit.height === size.height) {
    return { source, size };
  }
  const canvas = document.createElement('canvas');
  canvas.width = fit.width;
  canvas.height = fit.height;
  canvas.getContext('2d')!.drawImage(source as CanvasImageSource, 0, 0, fit.width, fit.height);
  return { source: canvas, size: fit };
}

function fitting(attached: Attached, fit: Fit): CoreRaster {
  const picture = attached.picture.bind(attached);
  attached.picture = (clip, source, w, h) => {
    const shrunk = fitted(source, { width: w, height: h }, fit);
    picture(clip, shrunk.source, shrunk.size.width, shrunk.size.height);
  };
  return rasterOf(attached, fit);
}

export async function createCore(canvas: HTMLCanvasElement, width: number, height: number, side = Infinity): Promise<CoreRaster> {
  if (!('gpu' in navigator)) {
    throw new Error('webgpu unavailable');
  }
  const core = await warmCore();
  const raster = fitting(overBytes(await core.WebCore.attach(canvas, width, height)), pictureSize(side));
  return releaseOnDispose(raster, canvas.getContext('webgpu') as GpuSurface | null);
}

const GL_CONTEXT = { antialias: false, depth: true };

export async function createCoreGl(canvas: HTMLCanvasElement, width: number, height: number, side = GL_PICTURE_SIDE): Promise<CoreRaster> {
  if (!canvas.getContext('webgl2', GL_CONTEXT)) {
    throw new Error('webgl2 unavailable');
  }
  const core = await warmCore();
  return fitting(overBytes(core.WebGlCore.attach(canvas, width, height)), pictureSize(Math.min(side, GL_PICTURE_SIDE)));
}
