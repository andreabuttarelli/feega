import { freezeMasks } from './masks';
import { inlineMedia, shrinkImage } from './inline-media';
import { js } from './html';
import { paintSvg } from './svg-paint';
import { planLayers, type Pass } from './layer-plan';
import { ERRORS } from '../custom/runtime';
export { contentStamp } from '../stamp';

export const CAPTURE_REQUEST = 'feega:capture';
export const CAPTURE_REPLY = 'feega:frame';
export const SCREENSHOT_URL = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js';
const MEDIA_TIMEOUT_MS = 8000;

export enum FrameFormat {
  Jpeg = 'jpeg',
  Bitmap = 'bitmap'
}

export enum Layering {
  Flat = 'flat',
  Split = 'split'
}

export enum Settle {
  Paint = 'paint',
  Seek = 'seek'
}

export type CaptureRequest = { type: typeof CAPTURE_REQUEST; id: string; format: FrameFormat; width: number; height: number; quality?: number; settle?: Settle; layering?: Layering };
export type ClipError = { clip: string; component: string; message: string };
export type CaptureReply = { type: typeof CAPTURE_REPLY; id: string; stamp?: string; url?: string; bitmap?: ImageBitmap; error?: string; layout?: string; errors?: ClipError[] };

type RuntimeConfig = { request: string; reply: string; lib: string; width: number; height: number; mediaTimeoutMs: number; stamp: string; errorsKey: string; settle: Settle };
type Shot = { body: Record<string, unknown>; transfer: Transferable[] };
type HtmlToImage = {
  toSvg: (node: HTMLElement, options: Record<string, unknown>) => Promise<string>;
  getFontEmbedCSS: (node: HTMLElement) => Promise<string>;
};

function captureRuntime(cfg: RuntimeConfig, freeze: () => Promise<() => void>, inline: typeof inlineMedia, shrink: typeof shrinkImage, paint: typeof paintSvg, plan: typeof planLayers) {
  const shrunk = new Map<string, Promise<string>>();
  let lib: Promise<unknown> | null = null;
  let fonts: Promise<string> | null = null;
  const tool = () => (window as unknown as { htmlToImage: HtmlToImage }).htmlToImage;

  const load = () =>
    (lib ??= new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = cfg.lib;
      s.onload = ok;
      s.onerror = ko;
      document.head.appendChild(s);
    }));
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  const painted = () => frame().then(frame);
  const settled = (v: HTMLVideoElement) => {
    if (!v.seeking && (v.readyState >= 2 || v.offsetParent === null)) {
      return Promise.resolve();
    }
    return new Promise<void>((r) => {
      v.addEventListener('seeked', () => r(), { once: true });
      v.addEventListener('loadeddata', () => r(), { once: true });
      setTimeout(r, cfg.mediaTimeoutMs);
      if (!v.seeking) {
        v.currentTime = v.currentTime;
      }
    });
  };
  const drawable = (node: Node) => !(node instanceof HTMLVideoElement) || (node.offsetParent !== null && node.readyState >= 2 && node.videoWidth > 0);
  const reason = (err: unknown) => {
    const src = (err as Event)?.target instanceof HTMLElement ? ((err as Event).target as HTMLImageElement).src?.slice(0, 80) : '';
    return err instanceof Event ? `a picture or video in this frame could not be drawn${src ? ` (${src})` : ''}` : String(err);
  };
  const mediaReady = () => Promise.all([...document.querySelectorAll('video')].map(settled));
  const settleBy: Record<`${Settle}`, () => Promise<unknown>> = {
    paint: () => painted().then(mediaReady).then(painted),
    seek: () => mediaReady().then((videos) => (videos.length ? frame() : undefined))
  };

  const size = (m: CaptureRequest, embed: string) => ({ width: cfg.width, height: cfg.height, canvasWidth: m.width, canvasHeight: m.height, pixelRatio: 1, fontEmbedCSS: embed, filter: drawable });
  const PRINT = { width: 64, height: 36 };
  const NESTED_PICTURE = 'data%3Aimage';
  const DOT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const canvasOf = (width: number, height: number) => Object.assign(document.createElement('canvas'), { width, height });
  const penOf = (width: number, height: number) => canvasOf(width, height).getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const picture = (url: string) =>
    new Promise<HTMLImageElement>((ok, ko) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = ko;
      img.src = url;
    });
  const dotSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><foreignObject width="1" height="1"><img xmlns="http://www.w3.org/1999/xhtml" src="${DOT}" width="1" height="1"/></foreignObject></svg>`)}`;
  let lazyProbe: Promise<boolean> | null = null;
  const lazyNesting = () =>
    (lazyProbe ??= picture(dotSvg)
      .then((img) => {
        const pen = penOf(1, 1);
        pen.drawImage(img, 0, 0);
        return pen.getImageData(0, 0, 1, 1).data[3] === 0;
      })
      .catch(() => false));
  const full = (img: HTMLImageElement, width: number, height: number) => {
    const out = canvasOf(width, height);
    (out.getContext('2d') as CanvasRenderingContext2D).drawImage(img, 0, 0, width, height);
    return out;
  };
  const painter = (lazy: boolean) => ({
    load: picture,
    settles: (url: string) => lazy && url.includes(NESTED_PICTURE),
    print: (img: HTMLImageElement) => {
      const pen = penOf(PRINT.width, PRINT.height);
      pen.drawImage(full(img, cfg.width, cfg.height), 0, 0, PRINT.width, PRINT.height);
      return pen.getImageData(0, 0, PRINT.width, PRINT.height).data.join();
    },
    tick: frame,
    draw: full
  });
  const svgOf = (root: HTMLElement, m: CaptureRequest, embed: string, options: Record<string, unknown> = {}) =>
    Promise.all([tool().toSvg(root, { ...size(m, embed), ...options }), lazyNesting()]).then(([url, lazy]) => paint(url, m.width, m.height, painter(lazy)));

  const PLAIN = new Set(['DIV', 'SPAN', 'CANVAS']);
  const INERT = new Set(['STYLE', 'SCRIPT']);
  const UPRIGHT = /^matrix\([-\d.e]+, 0, 0, [-\d.e]+, [-\d.e]+, [-\d.e]+\)$/;
  const SEEN_THROUGH = /rgba\(.*, 0\)$|^transparent$/;
  const none = (value: string | undefined) => !value || value === 'none';
  const flat = (el: Element, style: CSSStyleDeclaration, layer: Element) =>
    PLAIN.has(el.tagName) &&
    none(style.filter) &&
    none(style.maskImage || (style as unknown as { webkitMaskImage?: string }).webkitMaskImage) &&
    none(style.clipPath) &&
    none(style.backdropFilter) &&
    none(style.boxShadow) &&
    none(style.backgroundImage) &&
    (style.transform === 'none' || UPRIGHT.test(style.transform)) &&
    (el === layer || style.mixBlendMode === 'normal') &&
    (style.zIndex === 'auto' || el === layer) &&
    parseFloat(style.borderTopLeftRadius) + parseFloat(style.borderBottomRightRadius) + parseFloat(style.borderTopRightRadius) + parseFloat(style.borderBottomLeftRadius) === 0 &&
    parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth) === 0 &&
    [...el.childNodes].every((n) => n.nodeType !== Node.TEXT_NODE || !n.textContent?.trim());
  const drawnAlone = (layer: Element) => {
    const all = [layer, ...layer.querySelectorAll('*')].filter((el) => !INERT.has(el.tagName));
    return all.some((el) => el instanceof HTMLCanvasElement) && all.every((el) => flat(el, getComputedStyle(el), layer));
  };
  const factsOf = (layers: Element[]) =>
    layers.map((layer) => ({
      canvas: drawnAlone(layer),
      blend: getComputedStyle(layer).mixBlendMode,
      backdrop: [layer, ...layer.querySelectorAll('*')].some((el) => !none(getComputedStyle(el).backdropFilter))
    }));
  const OPERATION: Record<string, GlobalCompositeOperation> = { normal: 'source-over' };
  const operationOf = (blend: string) => OPERATION[blend] ?? (blend as GlobalCompositeOperation);
  type Place = { base: DOMRect; sx: number; sy: number; width: number; height: number };
  const boxOf = (el: Element, at: Place) => {
    const r = el.getBoundingClientRect();
    return [(r.left - at.base.left) * at.sx, (r.top - at.base.top) * at.sy, r.width * at.sx, r.height * at.sy] as const;
  };
  const paintEl = (pen: CanvasRenderingContext2D, el: Element, at: Place) => {
    if (INERT.has(el.tagName)) {
      return;
    }
    const style = getComputedStyle(el);
    const alpha = Number(style.opacity);
    if (style.display === 'none' || alpha <= 0) {
      return;
    }
    if (alpha < 1) {
      const group = canvasOf(at.width, at.height);
      paintOwn(group.getContext('2d') as CanvasRenderingContext2D, el, style, at);
      pen.globalAlpha = alpha;
      pen.drawImage(group, 0, 0);
      pen.globalAlpha = 1;
      return;
    }
    paintOwn(pen, el, style, at);
  };
  const paintOwn = (pen: CanvasRenderingContext2D, el: Element, style: CSSStyleDeclaration, at: Place) => {
    const [x, y, w, h] = boxOf(el, at);
    const shown = style.visibility !== 'hidden';
    if (shown && !SEEN_THROUGH.test(style.backgroundColor)) {
      pen.fillStyle = style.backgroundColor;
      pen.fillRect(x, y, w, h);
    }
    if (shown && el instanceof HTMLCanvasElement && w && h && el.width && el.height) {
      pen.drawImage(el, x, y, w, h);
    }
    const clips = style.overflow !== 'visible';
    if (clips) {
      pen.save();
      pen.beginPath();
      pen.rect(x, y, w, h);
      pen.clip();
    }
    for (const child of el.children) {
      paintEl(pen, child, at);
    }
    if (clips) {
      pen.restore();
    }
  };
  const drawCanvases = (pen: CanvasRenderingContext2D, layer: Element, root: HTMLElement, m: CaptureRequest) =>
    paintEl(pen, layer, { base: root.getBoundingClientRect(), sx: m.width / cfg.width, sy: m.height / cfg.height, width: m.width, height: m.height });
  const backdropOf = (root: HTMLElement) => {
    const style = getComputedStyle(root);
    return style.backgroundImage === 'none' ? style.backgroundColor : null;
  };
  const layered = async (root: HTMLElement, m: CaptureRequest, embed: string, passes: Pass[], layers: Element[]) => {
    const out = canvasOf(m.width, m.height);
    const pen = out.getContext('2d') as CanvasRenderingContext2D;
    const firstDom = passes.findIndex((p) => p.kind === 'dom');
    if (passes[0].kind === 'canvas') {
      pen.fillStyle = backdropOf(root) ?? 'transparent';
      pen.fillRect(0, 0, m.width, m.height);
    }
    for (const [index, pass] of passes.entries()) {
      pen.globalCompositeOperation = operationOf(pass.blend);
      if (pass.kind === 'canvas') {
        const own = canvasOf(m.width, m.height);
        drawCanvases(own.getContext('2d') as CanvasRenderingContext2D, layers[pass.layers[0]], root, m);
        pen.drawImage(own, 0, 0);
        continue;
      }
      const shown = new Set(pass.layers.map((i) => layers[i]));
      const hidden = new Set(layers.filter((l) => !shown.has(l)));
      const style = index === firstDom && passes[0].kind === 'dom' ? {} : { style: { background: 'transparent' } };
      const part = await svgOf(root, m, embed, { ...style, filter: (node: Node) => drawable(node) && !hidden.has(node as Element) });
      pen.drawImage(part, 0, 0);
    }
    pen.globalCompositeOperation = 'source-over';
    return out;
  };
  const LAYERED = 'split';
  const drawn = (root: HTMLElement, m: CaptureRequest, embed: string) => {
    const layers = [...root.children].filter((el) => !(el instanceof HTMLScriptElement) && !(el instanceof HTMLStyleElement));
    const passes = (m.layering ?? LAYERED) === LAYERED ? plan(factsOf(layers)) : [];
    const solid = passes[0]?.kind !== 'canvas' || backdropOf(root) !== null;
    if (!passes.some((p) => p.kind === 'canvas') || !solid) {
      return svgOf(root, m, embed);
    }
    return layered(root, m, embed, passes, layers);
  };
  const output: Record<string, (root: HTMLElement, m: CaptureRequest, embed: string) => Promise<Shot>> = {
    jpeg: (root, m, embed) => drawn(root, m, embed).then((canvas) => ({ body: { url: canvas.toDataURL('image/jpeg', m.quality ?? 1) }, transfer: [] })),
    bitmap: (root, m, embed) =>
      drawn(root, m, embed)
        .then((canvas) => createImageBitmap(canvas))
        .then((bitmap) => ({ body: { bitmap }, transfer: [bitmap] }))
  };

  const layout = (root: HTMLElement) => {
    let hash = 0x811c9dc5;
    const base = root.getBoundingClientRect();
    for (const el of root.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      const line = `${Math.round((r.left - base.left) * 2)},${Math.round((r.top - base.top) * 2)},${Math.round(r.width * 2)},${Math.round(r.height * 2)};`;
      for (let i = 0; i < line.length; i++) {
        hash = Math.imul(hash ^ line.charCodeAt(i), 0x01000193);
      }
    }
    return (hash >>> 0).toString(36);
  };
  const errors = () => ((window as unknown as Record<string, unknown>)[cfg.errorsKey] as unknown[] | undefined) ?? [];

  addEventListener('message', (e: MessageEvent) => {
    const m = e.data as CaptureRequest;
    if (!m || m.type !== cfg.request) {
      return;
    }
    const source = e.source as Window | null;
    const reply = (body: Record<string, unknown>, transfer: Transferable[]) => source?.postMessage({ type: cfg.reply, id: m.id, stamp: cfg.stamp, ...body }, { targetOrigin: '*', transfer });
    const root = document.getElementById('root') as HTMLElement;

    load()
      .then(() => (window as unknown as { __fontsReady?: Promise<unknown> }).__fontsReady ?? document.fonts.ready)
      .then(() => document.fonts.ready)
      .then(settleBy[m.settle ?? cfg.settle])
      .then(() => (window as unknown as { __hfWaitForSeekCompletion?: () => Promise<void> }).__hfWaitForSeekCompletion?.())
      .then(() => inline(root, shrink, shrunk))
      .then(() => (fonts ??= tool().getFontEmbedCSS(root)))
      .then((embed) => freeze().then((thaw) => output[m.format](root, m, embed).finally(thaw)))
      .then(
        (shot) => reply({ ...shot.body, layout: layout(root), errors: errors() }, shot.transfer),
        (err) => reply({ error: reason(err) }, [])
      );
  });
}

const STAMP = /"stamp":"([a-z0-9-]+)"/;

export function stampOf(html: string): string | null {
  return STAMP.exec(html)?.[1] ?? null;
}

export function captureScript(doc: { width: number; height: number }, stamp: string): string {
  const cfg: RuntimeConfig = { request: CAPTURE_REQUEST, reply: CAPTURE_REPLY, lib: SCREENSHOT_URL, width: doc.width, height: doc.height, mediaTimeoutMs: MEDIA_TIMEOUT_MS, stamp, errorsKey: ERRORS, settle: Settle.Paint };
  return `<script>(${captureRuntime.toString()})(${js(cfg)},(${freezeMasks.toString()}),(${inlineMedia.toString()}),(${shrinkImage.toString()}),(${paintSvg.toString()}),(${planLayers.toString()}));</script>`;
}
