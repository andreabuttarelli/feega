import { Texture } from 'pixi8';
import { createLru } from './lru';

const BUDGET_BYTES = 256 * 1024 * 1024;
const RGBA = 4;

export type TextureCache = {
  want: (url: string, ready: (tex: Texture) => void) => void;
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
  const lru = createLru<Texture>(BUDGET_BYTES, (_url, tex) => tex.destroy(true));
  const pending = new Map<string, ((tex: Texture) => void)[]>();

  return {
    want(url, ready) {
      const hit = lru.get(url);
      if (hit) {
        ready(hit);
        return;
      }
      const waiting = pending.get(url);
      if (waiting) {
        waiting.push(ready);
        return;
      }
      pending.set(url, [ready]);
      load(url)
        .then((bitmap) => {
          const tex = Texture.from(bitmap);
          lru.set(url, tex, bitmap.width * bitmap.height * RGBA);
          for (const r of pending.get(url) ?? []) {
            r(tex);
          }
          changed();
        })
        .catch(() => {})
        .finally(() => pending.delete(url));
    },
    clear() {
      lru.clear();
    }
  };
}
