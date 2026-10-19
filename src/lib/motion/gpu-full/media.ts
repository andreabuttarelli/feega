import { ItemKind, type DisplayList, type ImageItem } from './display-list';
import type { Picture, Pictures } from './raster';

const SEEK_SLACK_S = 0.001;

export type Media = { ready: (list: DisplayList) => Promise<void>; pictures: Pictures; dispose: () => void };

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  return img.decode().then(() => img);
}

function loadVideo(src: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  Object.assign(video, { crossOrigin: 'anonymous', muted: true, playsInline: true, preload: 'auto', src });
  return new Promise((resolve, reject) => {
    video.addEventListener('loadeddata', () => resolve(video), { once: true });
    video.addEventListener('error', () => reject(new Error(`video ${src}`)), { once: true });
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  const at = Math.min(time, Math.max(0, video.duration - SEEK_SLACK_S));
  if (Math.abs(video.currentTime - at) < SEEK_SLACK_S) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    video.addEventListener('seeked', () => resolve(), { once: true });
    video.currentTime = at;
  });
}

export function createMedia(): Media {
  const images = new Map<string, Promise<HTMLImageElement>>();
  const videos = new Map<string, Promise<HTMLVideoElement>>();
  const loaded = new Map<string, Picture>();

  const imageOf = (src: string) => images.get(src) ?? images.set(src, loadImage(src)).get(src)!;
  const videoOf = (clip: string, src: string) => videos.get(clip) ?? videos.set(clip, loadVideo(src)).get(clip)!;

  async function readyOne(item: ImageItem) {
    if (!item.video) {
      const img = await imageOf(item.src);
      loaded.set(item.clip, { source: img, size: { width: img.naturalWidth, height: img.naturalHeight } });
      return;
    }
    const video = await videoOf(item.clip, item.src);
    await seek(video, item.mediaTime);
    loaded.set(item.clip, { source: video, size: { width: video.videoWidth, height: video.videoHeight } });
  }

  async function ready(list: DisplayList) {
    const pictures = list.items.filter((i): i is ImageItem => i.kind === ItemKind.Image);
    await Promise.all(pictures.map((p) => readyOne(p).catch(() => loaded.delete(p.clip))));
  }

  function dispose() {
    for (const v of videos.values()) {
      void v.then((el) => el.removeAttribute('src'));
    }
  }

  return { ready, pictures: (item) => loaded.get(item.clip) ?? null, dispose };
}
