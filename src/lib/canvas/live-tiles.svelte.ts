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

export type PosterAsk = { live: boolean; drawn: boolean; unsaved: boolean; atHead: boolean; hasPoster: boolean; blankPoster: boolean; shooting: boolean };

export const posterDue = (ask: PosterAsk): boolean => ask.live && ask.drawn && !ask.unsaved && ask.atHead && (!ask.hasPoster || ask.blankPoster) && !ask.shooting;

export type Pixels = { width: number; height: number; data: Uint8ClampedArray };

const RGB = 3;
const RGBA = 4;
const BLANK_TOLERANCE = 24;

export function isBlankPixels(p: Pixels): boolean {
  for (let at = 0; at < p.data.length; at += RGBA) {
    for (let c = 0; c < RGB; c++) {
      if (Math.abs(p.data[at + c] - p.data[c]) > BLANK_TOLERANCE) {
        return false;
      }
    }
  }
  return true;
}
