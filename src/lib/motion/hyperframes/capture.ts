import { freezeMasks } from './masks';
import { inlineMedia, shrinkImage } from './inline-media';
import { js } from './html';
import { paintSvg } from './svg-paint';
import { planLayers, type Pass } from './layer-plan';
import { chain as chainAffine, cssAffine, cssMasks as readMasks, cssRgba, joinRasters, type LayerTree } from './layer-tree';
import { grainPixels, type GrainArea } from '../effects/grain';
import { GRAIN_SAMPLE_OFFSET, turbulenceTile } from '../effects/turbulence';
import { GRAIN_TILE } from '../effects/registry';
import { NOT_WEBKIT_UA, WEBKIT_UA } from '../engine';
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
  Split = 'split',
  Gpu = 'gpu'
}

export enum Settle {
  Paint = 'paint',
  Seek = 'seek'
}

export type CaptureRequest = { type: typeof CAPTURE_REQUEST; id: string; format: FrameFormat; width: number; height: number; quality?: number; settle?: Settle; layering?: Layering };
export type ClipError = { clip: string; component: string; message: string };
export type CaptureReply = { type: typeof CAPTURE_REPLY; id: string; stamp?: string; url?: string; bitmap?: ImageBitmap; tree?: LayerTree; sheets?: ImageBitmap[]; error?: string; layout?: string; errors?: ClipError[] };

type RuntimeConfig = { request: string; reply: string; lib: string; width: number; height: number; mediaTimeoutMs: number; stamp: string; errorsKey: string; settle: Settle; grainTile: number; grainOffset: number; webkitUa: string; notWebkitUa: string };
type Shot = { body: Record<string, unknown>; transfer: Transferable[] };
type HtmlToImage = {
  toSvg: (node: HTMLElement, options: Record<string, unknown>) => Promise<string>;
  getFontEmbedCSS: (node: HTMLElement) => Promise<string>;
};

function captureRuntime(cfg: RuntimeConfig, freeze: () => Promise<() => void>, inline: typeof inlineMedia, shrink: typeof shrinkImage, paint: typeof paintSvg, plan: typeof planLayers, grainOn: typeof grainPixels, tileOf: typeof turbulenceTile, chain: typeof chainAffine, affine: typeof cssAffine, rgba: typeof cssRgba, join: typeof joinRasters, cssMasks: typeof readMasks) {
  type Grain = { baseFrequency: number; seed: number; amount: number };
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
    blank: (print: string) => print.split(',').every((v, i) => i % 4 !== 3 || v === '0'),
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
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const corners = [
      [-REGION_MARGIN * width, -REGION_MARGIN * height],
      [(1 + REGION_MARGIN) * width, -REGION_MARGIN * height],
      [-REGION_MARGIN * width, (1 + REGION_MARGIN) * height],
      [(1 + REGION_MARGIN) * width, (1 + REGION_MARGIN) * height]
    ].map(([u, v]) => [o[0] + u * ex[0] + v * ey[0], o[1] + u * ex[1] + v * ey[1]]);
    const xs = corners.map((p) => p[0]);
    const ys = corners.map((p) => p[1]);
    const bounds = {
      left: Math.max(0, Math.floor(Math.min(...xs))),
      top: Math.max(0, Math.floor(Math.min(...ys))),
      right: Math.min(at.width, Math.ceil(Math.max(...xs))),
      bottom: Math.min(at.height, Math.ceil(Math.max(...ys)))
    };
    const area: GrainArea = { inverse: [a, b, c, d, -(a * o[0] + c * o[1]), -(b * o[0] + d * o[1])], width, height, margin: REGION_MARGIN };
    return { area, bounds };
  };
  const tiles = new Map<string, Uint8ClampedArray>();
  const tileFor = (g: Grain) => {
    const key = `${g.baseFrequency}:${g.seed}`;
    const known = tiles.get(key) ?? tileOf({ baseFrequency: g.baseFrequency, seed: g.seed, octaves: 1, size: cfg.grainTile, offset: cfg.grainOffset });
    tiles.set(key, known);
    return known;
  };
  const grain = (source: HTMLCanvasElement, grains: Grain[], place: ReturnType<typeof areaOf>) => {
    const out = canvasOf(source.width, source.height);
    const { left, top, right, bottom } = place.bounds;
    if (right <= left || bottom <= top) {
      return out;
    }
    const w = right - left;
    const h = bottom - top;
    const read = (source.getContext('2d') as CanvasRenderingContext2D).getImageData(left, top, w, h);
    const [a, b, c, d, e, f] = place.area.inverse;
    const area = { ...place.area, inverse: [a, b, c, d, e + a * left + c * top, f + b * left + d * top] };
    const layers = grains.map((g) => ({ amount: g.amount, tile: tileFor(g), tileSize: cfg.grainTile }));
    const done = grainOn(read.data, w, h, layers, area);
    (out.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(done as Uint8ClampedArray<ArrayBuffer>, w, h), left, top);
    return out;
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
  type Affine = [number, number, number, number, number, number];
  type Rgba = [number, number, number, number];
  type Paint = { kind: 'sheet'; sheet: number; width: number; height: number; at: Affine } | { kind: 'fill'; color: Rgba; width: number; height: number; at: Affine };
  type Effect = { kind: 'grain'; grains: Grain[]; area: GrainArea };
  type Mask = { paint: Paint; composite: string };
  type TreeNode = { paints: Paint[]; children: TreeNode[]; opacity: number; blend: string; effects: Effect[]; clip: Paint | null; masks: Mask[] };
  type Picture = { url: string; width: number; height: number };
  type Run = { raster: Element[] };
  type Walked = TreeNode | Run | null;
  const FLAT_PX = 0.5;
  const pointAt = (el: Element, x: number, y: number, at: Place) => {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;margin:0;padding:0;border:0`;
    el.appendChild(probe);
    const r = probe.getBoundingClientRect();
    probe.remove();
    return [(r.left - at.base.left) * at.sx, (r.top - at.base.top) * at.sy];
  };
  const affineOf = (el: Element, at: Place): Affine | null => {
    const o = pointAt(el, 0, 0, at);
    const x = pointAt(el, PROBE_STEP, 0, at);
    const y = pointAt(el, 0, PROBE_STEP, at);
    const far = pointAt(el, PROBE_STEP, PROBE_STEP, at);
    const flat = Math.abs(x[0] + y[0] - o[0] - far[0]) < FLAT_PX && Math.abs(x[1] + y[1] - o[1] - far[1]) < FLAT_PX;
    return flat ? [(x[0] - o[0]) / PROBE_STEP, (x[1] - o[1]) / PROBE_STEP, (y[0] - o[0]) / PROBE_STEP, (y[1] - o[1]) / PROBE_STEP, o[0], o[1]] : null;
  };
  const UPRIGHT_AFFINE = 1e-6;
  const upright = (m: Affine) => Math.abs(m[1]) < UPRIGHT_AFFINE && Math.abs(m[2]) < UPRIGHT_AFFINE;
  const leafAffine = (el: HTMLElement, parent: Affine, style: CSSStyleDeclaration): Affine | null => {
    const own = affine(style.transform, style.transformOrigin);
    return own && el.offsetParent === el.parentElement ? chain(chain(parent, [1, 0, 0, 1, el.offsetLeft, el.offsetTop]), own) : null;
  };
  const SHEET: Paint['kind'] = 'sheet';
  const FILL: Paint['kind'] = 'fill';
  const WHITE: Rgba = [1, 1, 1, 1];
  const hasText = (el: Element) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
  const boxed = (style: CSSStyleDeclaration) =>
    none(style.boxShadow) &&
    none(style.backgroundImage) &&
    none(style.clipPath) &&
    none(style.backdropFilter) &&
    parseFloat(style.borderTopLeftRadius) + parseFloat(style.borderBottomRightRadius) + parseFloat(style.borderTopRightRadius) + parseFloat(style.borderBottomLeftRadius) === 0 &&
    parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth) === 0;
  const isNode = (w: Walked): w is TreeNode => !!w && 'paints' in w;
  const plainNode = (n: TreeNode) => !n.paints.length && !n.effects.length && !n.masks.length && !n.clip && n.opacity === 1 && n.blend === 'normal';
  const grouped = (items: Walked[]) => join<TreeNode, Element>(items);
  type SheetPaint = Extract<Paint, { kind: 'sheet' }>;
  type Slot = { source: HTMLCanvasElement | Picture | Run; paint: SheetPaint };
  type Walk = { at: Place; slots: Slot[] };
  type Cropped = { canvas: HTMLCanvasElement; box: [number, number, number, number]; size: [number, number] } | null;
  const slotted = (w: Walk, source: Slot['source'], part: Omit<SheetPaint, 'kind' | 'sheet'>): SheetPaint => {
    const paint: SheetPaint = { kind: SHEET, sheet: -1, ...part };
    w.slots.push({ source, paint });
    return paint;
  };
  const cropped = (canvas: HTMLCanvasElement): Cropped => {
    const { width, height } = canvas;
    const alpha = (canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, width, height).data;
    let [x0, y0, x1, y1] = [width, height, 0, 0];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!alpha[(y * width + x) * 4 + 3]) {
          continue;
        }
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x + 1);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y + 1);
      }
    }
    if (x1 <= x0 || y1 <= y0) {
      return null;
    }
    const out = canvasOf(x1 - x0, y1 - y0);
    (out.getContext('2d') as CanvasRenderingContext2D).drawImage(canvas, -x0, -y0);
    return { canvas: out, box: [x0, y0, x1, y1], size: [width, height] };
  };
  const whole = (canvas: HTMLCanvasElement): Cropped => ({ canvas, box: [0, 0, canvas.width, canvas.height], size: [canvas.width, canvas.height] });
  const fit = (paint: SheetPaint, c: Cropped, sheet: number) => {
    if (!c) {
      paint.width = 0;
      paint.height = 0;
      return;
    }
    const kx = paint.width / c.size[0];
    const ky = paint.height / c.size[1];
    const [x0, y0, x1, y1] = c.box;
    paint.sheet = sheet;
    paint.at = chain(paint.at, [1, 0, 0, 1, x0 * kx, y0 * ky]);
    paint.width = (x1 - x0) * kx;
    paint.height = (y1 - y0) * ky;
  };
  type Prefixed = CSSStyleDeclaration & { webkitMaskImage?: string; webkitMaskComposite?: string };
  const scaleOf = (m: Affine) => Math.max(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]));
  const masksOf = (style: CSSStyleDeclaration, box: { width: number; height: number; at: Affine }, w: Walk): Mask[] | null => {
    const prefixed = style as Prefixed;
    const found = cssMasks(style.maskImage || prefixed.webkitMaskImage || 'none', style.maskComposite || prefixed.webkitMaskComposite || 'add');
    const scale = scaleOf(box.at);
    return (
      found?.map(({ url, composite }) => {
        const picture = { url, width: Math.max(1, Math.ceil(box.width * scale)), height: Math.max(1, Math.ceil(box.height * scale)) };
        return { paint: slotted(w, picture, box), composite };
      }) ?? null
    );
  };
  const canvasPaint = (el: HTMLCanvasElement, parent: Affine, style: CSSStyleDeclaration, w: Walk): Paint | null | undefined => {
    const at = leafAffine(el, parent, style);
    if (!at || !upright(at)) {
      return undefined;
    }
    if (!el.width || !el.height || !el.offsetWidth || !el.offsetHeight) {
      return null;
    }
    return slotted(w, el, { width: el.offsetWidth, height: el.offsetHeight, at });
  };
  const held = (parts: (TreeNode | Run)[], w: Walk) =>
    parts.map((p) => {
      if (isNode(p)) {
        return p;
      }
      const holder: TreeNode = { paints: [], children: [], opacity: 1, blend: 'normal', effects: [], clip: null, masks: [] };
      holder.paints.push(slotted(w, p, { width: w.at.width, height: w.at.height, at: [1, 0, 0, 1, 0, 0] }));
      return holder;
    });
  const walk = (el: Element, parent: Affine, w: Walk): Walked => {
    if (inert(el)) {
      return null;
    }
    const style = getComputedStyle(el);
    const opacity = Number(style.opacity);
    if (style.display === 'none' || opacity <= 0) {
      return null;
    }
    const raster: Run = { raster: [el] };
    if (!PLAIN.has(el.tagName) || hasText(el) || !boxed(style) || (el.parentElement && style.zIndex !== 'auto' && !stacked(el))) {
      return raster;
    }
    const shown = style.visibility !== 'hidden';
    if (el instanceof HTMLCanvasElement) {
      const paint = canvasPaint(el, parent, style, w);
      if (paint === undefined) {
        return raster;
      }
      return { paints: paint && shown ? [paint] : [], children: [], opacity, blend: style.mixBlendMode, effects: [], clip: null, masks: [] };
    }
    const grains = grainsOf(style);
    const at = grains ? affineOf(el, w.at) : null;
    if (!grains || !at || !upright(at)) {
      return raster;
    }
    const color = rgba(style.backgroundColor);
    const box = { width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight, at };
    const paints: Paint[] = color && shown ? [{ kind: FILL, color, ...box }] : [];
    const effects: Effect[] = grains.length ? [{ kind: 'grain', grains, area: areaOf(el as HTMLElement, w.at).area }] : [];
    const clip: Paint | null = style.overflow !== 'visible' ? { kind: FILL, color: WHITE, ...box } : null;
    const masks = masksOf(style, box, w);
    if (!masks) {
      return raster;
    }
    const parts = grouped([...el.children].map((child) => walk(child, at, w)));
    const self: TreeNode = { paints, children: [], opacity, blend: style.mixBlendMode, effects, clip, masks };
    if (parts.every((p) => !isNode(p)) && plainNode(self)) {
      return raster;
    }
    self.children = held(parts, w);
    return self;
  };
  const gpuOnly = (n: TreeNode): boolean => n.effects.length > 0 || n.masks.length > 0 || n.children.some(gpuOnly);
  const pictures = new Map<string, Promise<Cropped>>();
  const MAX_PICTURES = 64;
  const pictureOf = (p: Picture) => {
    const key = `${p.width}x${p.height}|${p.url}`;
    const known =
      pictures.get(key) ??
      picture(p.url).then((img) => {
        const out = canvasOf(p.width, p.height);
        (out.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D).drawImage(img, 0, 0, p.width, p.height);
        return cropped(out);
      });
    pictures.delete(key);
    pictures.set(key, known);
    if (pictures.size > MAX_PICTURES) {
      pictures.delete(pictures.keys().next().value as string);
    }
    return known;
  };
  const rasterKeys = new WeakMap<Element, { key: string; canvas: Cropped }>();
  const LIVE = 'canvas, video, iframe';
  const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const NEUTRAL: [string, string][] = Object.entries({ filter: 'none', opacity: '1', mixBlendMode: 'normal', backgroundColor: 'transparent', mask: 'none', WebkitMask: 'none' }).map(([name, value]) => [kebab(name), value]);
  const neutralised = (path: HTMLElement[]) => {
    const saved = path.map((el) => NEUTRAL.map(([name]) => [el.style.getPropertyValue(name), el.style.getPropertyPriority(name)] as const));
    path.forEach((el) => NEUTRAL.forEach(([name, value]) => el.style.setProperty(name, value, 'important')));
    return () => path.forEach((el, i) => NEUTRAL.forEach(([name], j) => el.style.setProperty(name, saved[i][j][0], saved[i][j][1])));
  };
  const pathOf = (root: HTMLElement, run: Run) => {
    const path: HTMLElement[] = [];
    for (let at = run.raster[0].parentElement; at && at !== root; at = at.parentElement) {
      path.push(at);
    }
    return path;
  };
  const keyOf = (root: HTMLElement, m: CaptureRequest, run: Run) => {
    const live = run.raster.some((el) => el.matches(LIVE) || el.querySelector(LIVE));
    return live ? null : `${m.width}x${m.height}|${pathOf(root, run).map((el) => el.getAttribute('style') ?? '').join('|')}|${run.raster.map((el) => el.outerHTML).join('')}`;
  };
  const seen = new WeakMap<Element, string>();
  const changing = (root: HTMLElement, m: CaptureRequest, run: Run) => {
    const key = keyOf(root, m, run);
    const before = seen.get(run.raster[0]);
    if (key !== null) {
      seen.set(run.raster[0], key);
    }
    return key === null || key !== before;
  };
  const rasterOf = async (root: HTMLElement, m: CaptureRequest, embed: string, run: Run) => {
    const path = pathOf(root, run);
    const key = keyOf(root, m, run);
    const known = rasterKeys.get(run.raster[0]);
    if (key !== null && known?.key === key) {
      return known.canvas;
    }
    const kept = new Set<Node>(path);
    const inside = (node: Node) => kept.has(node) || run.raster.some((el) => el === node || el.contains(node));
    const restore = neutralised(path);
    try {
      const shot = await svgOf(root, m, embed, { style: { background: 'transparent' }, filter: (node: Node) => drawable(node) && (!(node instanceof Element) || inside(node)) });
      const canvas = key === null ? whole(shot) : cropped(shot);
      if (key !== null) {
        rasterKeys.set(run.raster[0], { key, canvas });
      }
      return canvas;
    } finally {
      restore();
    }
  };
  const treeOf = async (root: HTMLElement, m: CaptureRequest, embed: string) => {
    const backdrop = backdropOf(root);
    const at = placeOf(root, m);
    const w: Walk = { at, slots: [] };
    const base: Affine = [at.sx, 0, 0, at.sy, 0, 0];
    const parts = grouped([...root.children].map((el) => walk(el, base, w)));
    if (backdrop === null || !parts.some((p) => isNode(p) && gpuOnly(p))) {
      return null;
    }
    const children = held(parts, w);
    const runs = w.slots.map((slot) => slot.source).filter((source): source is Run => 'raster' in source);
    if (runs.filter((run) => changing(root, m, run)).length > MAX_FRESH_RASTERS) {
      return null;
    }
    const sources: HTMLCanvasElement[] = [];
    for (const { source, paint } of w.slots) {
      const found = source instanceof HTMLCanvasElement ? whole(source) : 'raster' in source ? await rasterOf(root, m, embed, source) : await pictureOf(source);
      fit(paint, found, sources.length);
      if (found) {
        sources.push(found.canvas);
      }
    }
    const sheets = await Promise.all(sources.map((c) => createImageBitmap(c, { premultiplyAlpha: 'premultiply' })));
    const tree = { width: m.width, height: m.height, backdrop: rgba(backdrop), root: { paints: [], children, opacity: 1, blend: 'normal', effects: [], clip: null, masks: [] } };
    return { tree, sheets };
  };
  const MAX_FRESH_RASTERS = 2;
  const GPU = 'gpu';
  const FLAT = 'flat';
  const drawn = async (root: HTMLElement, m: CaptureRequest, embed: string) => {
    const layers = [...root.children].filter((el) => !(el instanceof HTMLScriptElement) && !(el instanceof HTMLStyleElement));
    const cpuFilters = new RegExp(cfg.webkitUa).test(navigator.userAgent) && !new RegExp(cfg.notWebkitUa).test(navigator.userAgent);
    const passes = m.layering !== FLAT ? plan(factsOf(layers, cpuFilters)) : [];
    const solid = passes[0]?.kind === 'dom' || backdropOf(root) !== null;
    if (!passes.some((p) => p.kind !== 'dom') || !solid) {
      return svgOf(root, m, embed);
    }
    return layered(root, m, embed, passes, layers);
  };
  const output: Record<string, (root: HTMLElement, m: CaptureRequest, embed: string) => Promise<Shot>> = {
    jpeg: (root, m, embed) => drawn(root, m, embed).then((canvas) => ({ body: { url: canvas.toDataURL('image/jpeg', m.quality ?? 1) }, transfer: [] })),
    bitmap: async (root, m, embed) => {
      const layered = m.layering === GPU ? await treeOf(root, m, embed) : null;
      if (layered) {
        return { body: layered, transfer: layered.sheets };
      }
      const bitmap = await createImageBitmap(await drawn(root, m, embed));
      return { body: { bitmap }, transfer: [bitmap] };
    }
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
  const cfg: RuntimeConfig = { request: CAPTURE_REQUEST, reply: CAPTURE_REPLY, lib: SCREENSHOT_URL, width: doc.width, height: doc.height, mediaTimeoutMs: MEDIA_TIMEOUT_MS, stamp, errorsKey: ERRORS, settle: Settle.Paint, grainTile: GRAIN_TILE, grainOffset: GRAIN_SAMPLE_OFFSET, webkitUa: WEBKIT_UA.source, notWebkitUa: NOT_WEBKIT_UA.source };
  return `<script>(${captureRuntime.toString()})(${js(cfg)},(${freezeMasks.toString()}),(${inlineMedia.toString()}),(${shrinkImage.toString()}),(${paintSvg.toString()}),(${planLayers.toString()}),(${grainPixels.toString()}),(${turbulenceTile.toString()}),(${chainAffine.toString()}),(${cssAffine.toString()}),(${cssRgba.toString()}),(${joinRasters.toString()}),(${readMasks.toString()}));</script>`;
}
