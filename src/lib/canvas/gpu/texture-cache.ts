import { ImageSource, Texture } from 'pixi8';
import { createLru } from './lru';
import { Counter, count, reportPending } from './frame-stats';

const BUDGET_BYTES = 256 * 1024 * 1024;
const RGBA = 4;

export type TextureCache = {
  want: (url: string, ready: (tex: Texture) => void) => () => void;
  clear: () => void;
};

async function load(url: string): Promise<ImageBitmap> {
  const res = await fetch(url, { credentials: 'same-origin', mode: 'cors' });
  if (!res.ok) {
    throw new Error(`${res.status} ${url}`);
  }
  return createImageBitmap(await res.blob());
}

export function createTextureCache(changed: () => void): TextureCache {
  const users = new Map<string, number>();
  const lru = createLru<Texture>(BUDGET_BYTES, (_url, tex) => tex.destroy(true), (url) => (users.get(url) ?? 0) > 0);
  const hold = (url: string) => {
    users.set(url, (users.get(url) ?? 0) + 1);
    let held = true;
    return () => {
      if (held) {
        held = false;
        users.set(url, (users.get(url) ?? 1) - 1);
      }
    };
  };
  const pending = new Map<string, ((tex: Texture) => void)[]>();

  return {
    want(url, ready) {
      const release = hold(url);
      const hit = lru.get(url);
      if (hit) {
        ready(hit);
        return release;
      }
      const waiting = pending.get(url);
      if (waiting) {
        waiting.push(ready);
        return release;
      }
      pending.set(url, [ready]);
      count(Counter.Fetch);
      reportPending(pending.size);
      load(url)
        .then((bitmap) => {
          const tex = new Texture({ source: new ImageSource({ resource: bitmap, autoGenerateMipmaps: true }) });
          lru.set(url, tex, bitmap.width * bitmap.height * RGBA);
          for (const r of pending.get(url) ?? []) {
            r(tex);
          }
          changed();
        })
        .catch(() => {})
        .finally(() => {
          pending.delete(url);
          reportPending(pending.size);
        });
      return release;
    },
    clear() {
      lru.clear();
    }
  };
}
