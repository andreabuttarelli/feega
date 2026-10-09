import { freezeMasks } from './masks';
import { inlineMedia, shrinkImage } from './inline-media';
import { js } from './html';
import { paintSvg } from './svg-paint';
import { planLayers, type Pass } from './layer-plan';
import { grainGl, type Grain, type GrainPass } from '../effects/grain-gl';
import { GRAIN_SAMPLE_OFFSET, turbulenceTile } from '../effects/turbulence';
import { GRAIN_TILE } from '../effects/registry';
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

type RuntimeConfig = { request: string; reply: string; lib: string; width: number; height: number; mediaTimeoutMs: number; stamp: string; errorsKey: string; settle: Settle; grainTile: number };
type Shot = { body: Record<string, unknown>; transfer: Transferable[] };
type HtmlToImage = {
  toSvg: (node: HTMLElement, options: Record<string, unknown>) => Promise<string>;
  getFontEmbedCSS: (node: HTMLElement) => Promise<string>;
};

function captureRuntime(cfg: RuntimeConfig, freeze: () => Promise<() => void>, inline: typeof inlineMedia, shrink: typeof shrinkImage, paint: typeof paintSvg, plan: typeof planLayers, grain: GrainPass) {
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
  const inert = (el: Element) => INERT.has(el.tagName) || (el.tagName.toLowerCase() === 'svg' && [...el.children].every((c) => c.tagName.toLowerCase() === 'defs'));
  const UPRIGHT = /^matrix\([-\d.e]+, 0, 0, [-\d.e]+, [-\d.e]+, [-\d.e]+\)$/;
  const SEEN_THROUGH = /rgba\(.*, 0\)$|^transparent$/;
  const none = (value: string | undefined) => !value || value === 'none';
  const FILTER_REF = /url\("?#([^")]+)"?\)/g;
  const GRAIN_CHAIN = 'feTurbulence feTile feColorMatrix feComposite feComposite';
  const attr = (el: Element | null | undefined, name: string) => el?.getAttribute(name) ?? '';
  const grainOf = (filter: Element | null): Grain | null => {
    const steps = [...(filter?.children ?? [])];
    const [noise, , matrix, mix, mask] = steps;
    const amount = Number(attr(mix, 'k2'));
    const fits =
      steps.map((n) => n.tagName).join(' ') === GRAIN_CHAIN &&
      attr(noise, 'type') === 'fractalNoise' &&
      attr(noise, 'numOctaves') === '1' &&
      attr(noise, 'stitchTiles') === 'stitch' &&
      Number(attr(noise, 'width')) === cfg.grainTile &&
      attr(matrix, 'type') === 'saturate' &&
      Number(attr(matrix, 'values')) === 0 &&
      attr(mix, 'operator') === 'arithmetic' &&
      Number(attr(mix, 'k1')) === 0 &&
      Number(attr(mix, 'k3')) === 1 &&
      Math.abs(Number(attr(mix, 'k4')) + amount / 2) < 1e-4 &&
      attr(mask, 'operator') === 'in' &&
      attr(mask, 'in2') === 'SourceAlpha' &&
      attr(filter, 'x') === '-25%' &&
      attr(filter, 'width') === '150%';
    return fits ? { baseFrequency: Number(attr(noise, 'baseFrequency')), seed: Number(attr(noise, 'seed')), amount } : null;
  };
  const grainsOf = (style: CSSStyleDeclaration): Grain[] | null => {
    if (none(style.filter)) {
      return [];
    }
    const ids = [...style.filter.matchAll(FILTER_REF)].map((m) => m[1]);
    if (style.filter.replace(FILTER_REF, '').trim() || !ids.length) {
      return null;
    }
    const grains = ids.map((id) => grainOf(document.getElementById(id)));
    return grains.every((g) => g) ? (grains as Grain[]) : null;
  };
  const stacked = (el: Element) => {
    const order = [...(el.parentElement?.children ?? [])].map((c) => parseInt(getComputedStyle(c).zIndex) || 0);
    return order.every((z, i) => i === 0 || z >= order[i - 1]);
  };
  const flat = (el: Element, style: CSSStyleDeclaration, layer: Element) =>
    PLAIN.has(el.tagName) &&
    grainsOf(style) !== null &&
    none(style.maskImage || (style as unknown as { webkitMaskImage?: string }).webkitMaskImage) &&
    none(style.clipPath) &&
    none(style.backdropFilter) &&
    none(style.boxShadow) &&
    none(style.backgroundImage) &&
    (style.transform === 'none' || UPRIGHT.test(style.transform)) &&
    (el === layer || style.mixBlendMode === 'normal') &&
    (style.zIndex === 'auto' || el === layer || stacked(el)) &&
    parseFloat(style.borderTopLeftRadius) + parseFloat(style.borderBottomRightRadius) + parseFloat(style.borderTopRightRadius) + parseFloat(style.borderBottomLeftRadius) === 0 &&
    parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth) === 0 &&
    [...el.childNodes].every((n) => n.nodeType !== Node.TEXT_NODE || !n.textContent?.trim());
  const drawnAlone = (layer: Element) => {
    const all = [layer, ...layer.querySelectorAll('*')].filter((el) => !el.closest('svg, style, script') || (el.tagName.toLowerCase() === 'svg' && !inert(el)));
    return all.some((el) => el instanceof HTMLCanvasElement) && all.every((el) => flat(el, getComputedStyle(el), layer));
  };
  const FLAT_TRANSFORM = /^(none|matrix\()/;
  const paintsNothing = (el: Element, style: CSSStyleDeclaration) =>
    PLAIN.has(el.tagName) &&
    !(el instanceof HTMLCanvasElement) &&
    SEEN_THROUGH.test(style.backgroundColor) &&
    none(style.backgroundImage) &&
    none(style.boxShadow) &&
    parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth) === 0 &&
    [...el.childNodes].every((n) => n.nodeType !== Node.TEXT_NODE || !n.textContent?.trim());
  const grainedIn = (layer: Element): Element | null => {
    const filtered = [layer, ...layer.querySelectorAll('*')].filter((el) => !el.closest('svg, style, script') && !none(getComputedStyle(el).filter));
    const target = filtered.length === 1 ? filtered[0] : null;
    const style = target ? getComputedStyle(target) : null;
    if (!target || !style || !grainsOf(style)?.length || style.position === 'static' || Number(style.opacity) !== 1 || !FLAT_TRANSFORM.test(style.transform)) {
      return null;
    }
    for (let at = target.parentElement; at && at !== layer.parentElement; at = at.parentElement) {
      const up = getComputedStyle(at);
      const wraps = paintsNothing(at, up) && Number(up.opacity) === 1 && none(up.maskImage || (up as unknown as { webkitMaskImage?: string }).webkitMaskImage) && none(up.clipPath) && FLAT_TRANSFORM.test(up.transform);
      if (!wraps || (at !== layer && up.mixBlendMode !== 'normal')) {
        return null;
      }
    }
    const beside = [...layer.querySelectorAll('*')].filter((el) => !el.closest('svg, style, script') && !target.contains(el) && !el.contains(target));
    return beside.every((el) => paintsNothing(el, getComputedStyle(el))) ? target : null;
  };
  const kindOf = (layer: Element, cpuFilters: boolean) => (drawnAlone(layer) ? 'canvas' : cpuFilters && grainedIn(layer) ? 'grain' : 'dom') as Pass['kind'];
  const factsOf = (layers: Element[], cpuFilters: boolean) =>
    layers.map((layer) => ({
      kind: kindOf(layer, cpuFilters),
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
    if (inert(el)) {
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
  const REGION_MARGIN = 0.25;
  const PROBE_STEP = 100;
  const areaOf = (el: HTMLElement, at: Place) => {
    const probes = [
      [0, 0],
      [PROBE_STEP, 0],
      [0, PROBE_STEP]
    ].map(([x, y]) => {
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;margin:0;padding:0;border:0`;
      el.appendChild(probe);
      return probe;
    });
    const [o, px, py] = probes.map((probe) => {
      const r = probe.getBoundingClientRect();
      probe.remove();
      return [(r.left - at.base.left) * at.sx, (r.top - at.base.top) * at.sy];
    });
    const ex = [(px[0] - o[0]) / PROBE_STEP, (px[1] - o[1]) / PROBE_STEP];
    const ey = [(py[0] - o[0]) / PROBE_STEP, (py[1] - o[1]) / PROBE_STEP];
    const det = ex[0] * ey[1] - ey[0] * ex[1];
    const a = ey[1] / det;
    const c = -ey[0] / det;
    const b = -ex[1] / det;
    const d = ex[0] / det;
    return { inverse: [a, b, c, d, -(a * o[0] + c * o[1]), -(b * o[0] + d * o[1])], width: el.offsetWidth, height: el.offsetHeight, margin: REGION_MARGIN };
  };
  const paintOwn = (pen: CanvasRenderingContext2D, el: Element, style: CSSStyleDeclaration, at: Place) => {
    const grains = grainsOf(style) ?? [];
    if (!grains.length) {
      paintBox(pen, el, style, at);
      return;
    }
    const raw = canvasOf(at.width, at.height);
    paintBox(raw.getContext('2d') as CanvasRenderingContext2D, el, style, at);
    pen.drawImage(grain(raw, grains, areaOf(el as HTMLElement, at)), 0, 0);
  };
  const paintBox = (pen: CanvasRenderingContext2D, el: Element, style: CSSStyleDeclaration, at: Place) => {
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
  const placeOf = (root: HTMLElement, m: CaptureRequest): Place => ({ base: root.getBoundingClientRect(), sx: m.width / cfg.width, sy: m.height / cfg.height, width: m.width, height: m.height });
  const drawCanvases = (pen: CanvasRenderingContext2D, layer: Element, root: HTMLElement, m: CaptureRequest) => paintEl(pen, layer, placeOf(root, m));
  const grainedPass = async (root: HTMLElement, m: CaptureRequest, embed: string, layer: Element, hidden: Set<Element>) => {
    const target = grainedIn(layer) as HTMLElement;
    const grains = grainsOf(getComputedStyle(target)) as Grain[];
    const area = areaOf(target, placeOf(root, m));
    const before = target.style.getPropertyValue('filter');
    const priority = target.style.getPropertyPriority('filter');
    target.style.setProperty('filter', 'none', 'important');
    try {
      const part = await svgOf(root, m, embed, { style: { background: 'transparent' }, filter: (node: Node) => drawable(node) && !hidden.has(node as Element) });
      return grain(part, grains, area);
    } finally {
      target.style.setProperty('filter', before, priority);
    }
  };
  const backdropOf = (root: HTMLElement) => {
    const style = getComputedStyle(root);
    return style.backgroundImage === 'none' ? style.backgroundColor : null;
  };
  const layered = async (root: HTMLElement, m: CaptureRequest, embed: string, passes: Pass[], layers: Element[]) => {
    const out = canvasOf(m.width, m.height);
    const pen = out.getContext('2d') as CanvasRenderingContext2D;
    const firstDom = passes.findIndex((p) => p.kind === 'dom');
    if (passes[0].kind !== 'dom') {
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
      if (pass.kind === 'grain') {
        pen.drawImage(await grainedPass(root, m, embed, layers[pass.layers[0]], hidden), 0, 0);
        continue;
      }
      const style = index === firstDom && passes[0].kind === 'dom' ? {} : { style: { background: 'transparent' } };
      const part = await svgOf(root, m, embed, { ...style, filter: (node: Node) => drawable(node) && !hidden.has(node as Element) });
      pen.drawImage(part, 0, 0);
    }
    pen.globalCompositeOperation = 'source-over';
    return out;
  };
  const LAYERED = 'split';
  const SOFTWARE_FILTERS = /AppleWebKit/;
  const GPU_FILTERS = /Chrome\/|Firefox\//;
  const drawn = async (root: HTMLElement, m: CaptureRequest, embed: string) => {
    const layers = [...root.children].filter((el) => !(el instanceof HTMLScriptElement) && !(el instanceof HTMLStyleElement));
    const cpuFilters = SOFTWARE_FILTERS.test(navigator.userAgent) && !GPU_FILTERS.test(navigator.userAgent);
    const passes = (m.layering ?? LAYERED) === LAYERED ? plan(factsOf(layers, cpuFilters)) : [];
    const solid = passes[0]?.kind === 'dom' || backdropOf(root) !== null;
    if (!passes.some((p) => p.kind !== 'dom') || !solid) {
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
  const cfg: RuntimeConfig = { request: CAPTURE_REQUEST, reply: CAPTURE_REPLY, lib: SCREENSHOT_URL, width: doc.width, height: doc.height, mediaTimeoutMs: MEDIA_TIMEOUT_MS, stamp, errorsKey: ERRORS, settle: Settle.Paint, grainTile: GRAIN_TILE };
  return `<script>(${captureRuntime.toString()})(${js(cfg)},(${freezeMasks.toString()}),(${inlineMedia.toString()}),(${shrinkImage.toString()}),(${paintSvg.toString()}),(${planLayers.toString()}),(${grainGl.toString()})((${turbulenceTile.toString()}),${GRAIN_TILE},${GRAIN_SAMPLE_OFFSET}));</script>`;
}
