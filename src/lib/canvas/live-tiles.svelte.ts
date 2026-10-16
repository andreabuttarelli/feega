import { untrack } from 'svelte';
import { Viewport, viewportOf } from '$lib/motion/editor-layout';

export const LIVE_CAP: Record<Viewport, number> = {
  [Viewport.Desktop]: 6,
  [Viewport.Tablet]: 4,
  [Viewport.Phone]: 2
};

export function liveTiles(cap: () => number) {
  let queue = $state<string[]>([]);

  return {
    want(id: string) {
      untrack(() => {
        if (!queue.includes(id)) {
          queue = [...queue, id];
        }
      });
    },
    drop(id: string) {
      untrack(() => {
        queue = queue.filter((q) => q !== id);
      });
    },
    live: (id: string) => {
      const at = queue.indexOf(id);
      return at >= 0 && at < cap();
    }
  };
}

export const tiles = liveTiles(() => LIVE_CAP[typeof window === 'undefined' ? Viewport.Desktop : viewportOf(innerWidth)]);
