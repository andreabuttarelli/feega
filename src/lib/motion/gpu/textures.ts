import { ImageSource, Texture, type TextureSourceLike } from 'pixi8';
import { fitRect, logoRect } from './fit';
import { PAINT_PATTERN, patternOf } from './fill-pattern';
import { scaleOf, type Size } from './matrix';
import { PaintKind } from './paint-of';
import type { Placement } from './renderer';
import type { Drawn, Paint, SceneLayer } from './scene';
import type { TextRaster } from './text-layout';

type Of<K extends PaintKind> = Extract<Paint, { kind: K }>;

const RASTER_STEPS = 2;
const MAX_RASTER = 3;
const SVG_NS = 'http://www.w3.org/2000/svg';
const VIDEO_TIMEOUT_MS = 3000;

export type Painter = { texts: (rasters: Map<SceneLayer, TextRaster>) => void; prepare: (items: Drawn[], t: number) => Promise<void>; place: (d: Drawn) => Placement | null; fill: (color: string, size: Size) => Texture };

function picture(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => ok(img);
    img.onerror = ko;
    img.src = src;
  });
}

const rasterScale = (d: Drawn, resolution: number) => Math.min(MAX_RASTER * resolution, Math.max(1, Math.ceil(scaleOf(d.matrix) * resolution * RASTER_STEPS) / RASTER_STEPS));

export function sharp(resource: TextureSourceLike): Texture {
  return new Texture({ source: new ImageSource({ resource: resource as never, autoGenerateMipmaps: true, scaleMode: 'linear' }) });
}

function svgUrl(markup: string, size: Size, scale: number, pad: number): string {
  const doc = new DOMParser().parseFromString(markup.includes('xmlns=') ? markup : markup.replace('<svg', `<svg xmlns="${SVG_NS}"`), 'image/svg+xml');
  const svg = doc.documentElement;
  const [x = 0, y = 0, w = size.width, h = size.height] = (svg.getAttribute('viewBox') ?? '').split(/\s+/).filter(Boolean).map(Number);
  const unit = w / size.width;
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `${x - pad * unit} ${y - pad * unit} ${w + 2 * pad * unit} ${h + 2 * pad * unit}`);
  svg.setAttribute('width', String(Math.ceil((size.width + 2 * pad) * scale)));
  svg.setAttribute('height', String(Math.ceil((size.height + 2 * pad) * scale)));
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
}

function fillCanvas(color: string, pattern: string, size: Size): HTMLCanvasElement {
  const canvas = Object.assign(document.createElement('canvas'), { width: size.width, height: size.height });
  const pen = canvas.getContext('2d') as CanvasRenderingContext2D;
  pen.fillStyle = color || 'transparent';
  pen.fillRect(0, 0, size.width, size.height);
  const found = patternOf(pattern);
  if (found) {
    PAINT_PATTERN[found.kind](pen, size, found.color);
  }
  return canvas;
}

function seeked(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 1e-3 && video.readyState >= 2) {
    return Promise.resolve();
  }
  return new Promise((ok) => {
    const done = () => ok();
    video.addEventListener('seeked', done, { once: true });
    setTimeout(done, VIDEO_TIMEOUT_MS);
    video.currentTime = time;
  });
}

function pixels(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
  (canvas.getContext('2d') as CanvasRenderingContext2D).drawImage(img, 0, 0);
  return canvas;
}

export function createPainter(resolution = 1): Painter {
  const images = new Map<string, Promise<HTMLImageElement>>();
  const loaded = new Map<string, { texture: Texture; natural: Size }>();
  const videos = new Map<string, { el: HTMLVideoElement; texture: Texture | null }>();
  const fills = new Map<string, Texture>();
  const texts = new Map<SceneLayer, Texture>();

  const load = (key: string, src: string) => {
    if (!images.has(key)) {
      images.set(
        key,
        picture(src).then((img) => {
          loaded.set(key, { texture: sharp(pixels(img)), natural: { width: img.naturalWidth, height: img.naturalHeight } });
          return img;
        })
      );
    }
    return images.get(key)!;
  };

  const shapeKey = (d: Drawn) => `${(d.paint as Of<PaintKind.Shape>).markup}@${rasterScale(d, resolution)}`;

  const videoOf = (paint: Of<PaintKind.Video>) => {
    let entry = videos.get(paint.src);
    if (!entry) {
      const el = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous', src: paint.src });
      entry = { el, texture: null };
      videos.set(paint.src, entry);
    }
    return entry;
  };

  const PREPARE: Record<PaintKind, (d: Drawn, t: number) => Promise<unknown>> = {
    [PaintKind.Fill]: async () => {},
    [PaintKind.Text]: async () => {},
    [PaintKind.Html]: async () => {},
    [PaintKind.Shape]: (d) => {
      const paint = d.paint as Of<PaintKind.Shape>;
      return load(shapeKey(d), svgUrl(paint.markup, paint.size, rasterScale(d, resolution), paint.pad));
    },
    [PaintKind.Image]: (d) => load((d.paint as Of<PaintKind.Image>).src, (d.paint as Of<PaintKind.Image>).src),
    [PaintKind.Logo]: (d) => load((d.paint as Of<PaintKind.Logo>).src, (d.paint as Of<PaintKind.Logo>).src),
    [PaintKind.Video]: async (d, t) => {
      const paint = d.paint as Of<PaintKind.Video>;
      const entry = videoOf(paint);
      await seeked(entry.el, paint.mediaStart + (t - paint.start) * paint.rate);
      entry.texture ??= Texture.from(entry.el);
      entry.texture.source.update();
    }
  };

  const fill = (color: string, size: Size, pattern = '') => {
    const key = `${color}|${pattern}|${size.width}x${size.height}`;
    if (!fills.has(key)) {
      fills.set(key, sharp(fillCanvas(color, pattern, size)));
    }
    return fills.get(key)!;
  };

  const whole = (texture: Texture, size: Size): Placement => ({ texture, rect: [0, 0, size.width, size.height] });

  const PLACE: Record<PaintKind, (d: Drawn) => Placement | null> = {
    [PaintKind.Html]: () => null,
    [PaintKind.Text]: (d) => {
      const texture = texts.get(d.layer);
      return texture ? whole(texture, d.content) : null;
    },
    [PaintKind.Fill]: (d) => {
      const paint = d.paint as Of<PaintKind.Fill>;
      return whole(fill(paint.color, d.content, paint.pattern), d.content);
    },
    [PaintKind.Shape]: (d) => {
      const entry = loaded.get(shapeKey(d));
      const { pad } = d.paint as Of<PaintKind.Shape>;
      return entry ? { texture: entry.texture, rect: [-pad, -pad, d.content.width + 2 * pad, d.content.height + 2 * pad] } : null;
    },
    [PaintKind.Image]: (d) => {
      const paint = d.paint as Of<PaintKind.Image>;
      const entry = loaded.get(paint.src);
      return entry ? { texture: entry.texture, rect: fitRect(paint.fit, d.content, entry.natural, d.focus) } : null;
    },
    [PaintKind.Logo]: (d) => {
      const entry = loaded.get((d.paint as Of<PaintKind.Logo>).src);
      return entry ? { texture: entry.texture, rect: logoRect(d.content, entry.natural) } : null;
    },
    [PaintKind.Video]: (d) => {
      const paint = d.paint as Of<PaintKind.Video>;
      const entry = videos.get(paint.src);
      return entry?.texture ? { texture: entry.texture, rect: fitRect(paint.fit, d.content, { width: entry.el.videoWidth, height: entry.el.videoHeight }, [0.5, 0.5]) } : null;
    }
  };

  return {
    texts: (rasters) => rasters.forEach((r, layer) => texts.set(layer, sharp(r.canvas))),
    prepare: async (items, t) => {
      await Promise.all(items.map((d) => PREPARE[d.paint.kind](d, t).catch(() => null)));
    },
    place: (d) => PLACE[d.paint.kind](d),
    fill: (color, size) => fill(color, size)
  };
}
