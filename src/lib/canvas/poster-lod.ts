import type { Viewport } from './dot-grid';
import { AssetSize, sized } from './asset-url';

export const LOD_ZOOM = 0.3;
export const THUMB_WIDTH = 160;

export const lodWanted = (zoom: number) => zoom < LOD_ZOOM;
export const LOD_EXIT_ZOOM = LOD_ZOOM * 1.05;

export const lodNext = (active: boolean, zoom: number) => (active ? zoom < LOD_EXIT_ZOOM : lodWanted(zoom));

export type PlacedNode = { id: string; x: number; y: number; w: number; h: number };
export type ScreenRect = { id: string; x: number; y: number; w: number; h: number };

export function posterRects(nodes: PlacedNode[], view: Viewport, screen: { width: number; height: number }, posters: Set<string>): ScreenRect[] {
  const rects: ScreenRect[] = [];
  for (const node of nodes) {
    if (!posters.has(node.id)) {
      continue;
    }
    const rect = { id: node.id, x: node.x * view.zoom + view.x, y: node.y * view.zoom + view.y, w: node.w * view.zoom, h: node.h * view.zoom };
    if (rect.x > screen.width || rect.y > screen.height || rect.x + rect.w < 0 || rect.y + rect.h < 0) {
      continue;
    }
    rects.push(rect);
  }
  return rects;
}

export enum PosterSource {
  Image = 'image',
  VideoFrame = 'video'
}

export type Poster = { url: string; source: PosterSource };

const MEDIA_POSTER: Partial<Record<string, (url: string) => Poster>> = {
  image: (url) => ({ url: sized(url, AssetSize.Px256), source: PosterSource.Image }),
  video: (url) => ({ url, source: PosterSource.VideoFrame })
};

export function mediaPoster(type: string, url: string | null): Poster | null {
  const poster = MEDIA_POSTER[type];
  return poster && url ? poster(url) : null;
}

export function oncePerUrl<T>(load: (url: string) => Promise<T>, limit: number): (url: string) => Promise<T> {
  const loaded = new Map<string, Promise<T>>();
  const waiting: (() => void)[] = [];
  let running = 0;

  async function slot<R>(work: () => Promise<R>): Promise<R> {
    if (running >= limit) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else {
      running += 1;
    }
    try {
      return await work();
    } finally {
      const next = waiting.shift();
      if (next) {
        next();
      } else {
        running -= 1;
      }
    }
  }

  return (url) => {
    let promise = loaded.get(url);
    if (!promise) {
      promise = slot(() => load(url));
      loaded.set(url, promise);
    }
    return promise;
  };
}

export const LOD_CLASS = 'poster-lod';
export const POSTER_CLASS = 'has-poster';
