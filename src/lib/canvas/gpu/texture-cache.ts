import { ImageSource, Texture } from 'pixi8';
import { createLru } from './lru';
import { Counter, count, reportPending } from './frame-stats';
import { BUDGET, decodeSize, type Device } from './memory-budget';
import { bytesOf } from './texture-bytes';

export type TextureCache = {
  want: (url: string, ready: (tex: Texture) => void) => () => void;
  clear: () => void;
};

type Hooks = { changed: () => void; device: Device; pinned: (url: string) => boolean; evicted: (url: string) => void };

export async function fitBitmap(full: ImageBitmap, device: Device): Promise<ImageBitmap> {
  const size = decodeSize(full.width, full.height, device);
  if (size.width === full.width && size.height === full.height) {
    return full;
  }
  return createImageBitmap(full, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' });
}

async function decodeFitting(blob: Blob, device: Device): Promise<ImageBitmap> {
  const full = await createImageBitmap(blob);
  const fitted = await fitBitmap(full, device);
  if (fitted !== full) {
    full.close();
  }
  return fitted;
}

async function load(url: string, device: Device): Promise<ImageBitmap> {
  const res = await fetch(url, { credentials: 'same-origin', mode: 'cors' });
  if (!res.ok) {
    throw new Error(`${res.status} ${url}`);
  }
  return decodeFitting(await res.blob(), device);
}

export function createTextureCache({ changed, device, pinned, evicted }: Hooks): TextureCache {
  const lru = createLru<Texture>(
    BUDGET[device].textureBytes,
    (url, tex) => {
      tex.destroy(true);
      evicted(url);
    },
    pinned
  );
  const pending = new Map<string, Set<(tex: Texture) => void>>();

  return {
    want(url, ready) {
      const hit = lru.get(url);
      if (hit) {
        ready(hit);
        return () => {};
      }
      const waiting = pending.get(url);
      if (waiting) {
        waiting.add(ready);
        return () => waiting.delete(ready);
      }
      const fresh = new Set([ready]);
      pending.set(url, fresh);
      count(Counter.Fetch);
      reportPending(pending.size);
      load(url, device)
        .then((bitmap) => {
          const tex = new Texture({ source: new ImageSource({ resource: bitmap, autoGenerateMipmaps: true }) });
          lru.set(url, tex, bytesOf({ pixelWidth: bitmap.width, pixelHeight: bitmap.height, autoGenerateMipmaps: true }));
          for (const r of fresh) {
            r(tex);
          }
          changed();
        })
        .catch(() => {})
        .finally(() => {
          pending.delete(url);
          reportPending(pending.size);
        });
      return () => fresh.delete(ready);
    },
    clear() {
      lru.clear();
    }
  };
}
