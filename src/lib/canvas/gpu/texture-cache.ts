import { ImageSource, Texture } from 'pixi8';
import { createLru } from './lru';
import { Counter, count, reportPending } from './frame-stats';
import { BUDGET, decodeSize, type Device } from './memory-budget';
import type { UploadQueue } from './upload-queue';
import { bytesOf } from './texture-bytes';

export type TextureCache = {
  want: (url: string, ready: (tex: Texture) => void) => () => void;
  drop: (url: string) => void;
  clear: () => void;
};

type Hooks = { changed: () => void; device: Device; pinned: (url: string) => boolean; evicted: (url: string) => void; decode: (url: string, edge: number) => Promise<ImageBitmap>; queue: UploadQueue; upload: (tex: Texture) => void };

export async function fitBitmap(full: ImageBitmap, device: Device): Promise<ImageBitmap> {
  const size = decodeSize(full.width, full.height, device);
  if (size.width === full.width && size.height === full.height) {
    return full;
  }
  return createImageBitmap(full, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' });
}

export function createTextureCache({ changed, device, pinned, evicted, decode, queue, upload }: Hooks): TextureCache {
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
      const settle = () => {
        pending.delete(url);
        reportPending(pending.size);
      };
      decode(url, BUDGET[device].decodeEdge)
        .then((bitmap) =>
          queue.push(url, () => {
            const tex = new Texture({ source: new ImageSource({ resource: bitmap, autoGenerateMipmaps: true }) });
            upload(tex);
            lru.set(url, tex, bytesOf({ pixelWidth: bitmap.width, pixelHeight: bitmap.height, autoGenerateMipmaps: true }));
            for (const r of fresh) {
              r(tex);
            }
            settle();
            changed();
          })
        )
        .catch(settle);
      return () => fresh.delete(ready);
    },
    drop(url) {
      lru.drop(url);
    },
    clear() {
      lru.clear();
    }
  };
}
