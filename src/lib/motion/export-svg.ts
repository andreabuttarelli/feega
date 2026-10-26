import { IDENTITY, apply2d, type Affine } from '@feega/motion-core/motion/affine';
import { commonGap } from './export-gaps';
import { MaskMode } from '@feega/motion-core/motion/mask';
import { CoverKind } from '@feega/motion-core/motion/gpu-full/mask-layers';
import { ItemKind, PaintKind, type DisplayList, type ImageItem, type Item, type MaskLayer, type Paint, type PathItem } from '@feega/motion-core/motion/gpu-full/display-list';
import { FillRule } from '@feega/motion-core/motion/gpu-full/paint';
import type { Rgba } from '@feega/motion-core/motion/gpu-full/rgba';
import type { Crop } from './export-vector';

export type SvgOptions = { scale: number; crop?: Crop; images: ReadonlyMap<string, string> };

export type SvgResult = { svg: string; skipped: string[] };

const DECIMALS = 1000;
const BYTE = 255;
const WIDE = 100000;

const FIT: Record<string, string> = { cover: 'xMidYMid slice', contain: 'xMidYMid meet', fill: 'none' };

const CENTRE = 0.5;

type Writer = { defs: string[]; skipped: string[]; nextId: (prefix: string) => string; options: SvgOptions; frame: { width: number; height: number } };

const num = (n: number) => String(Math.round(n * DECIMALS) / DECIMALS);

const hex = (c: Rgba) => `#${[c[0], c[1], c[2]].map((v) => Math.round(Math.min(1, Math.max(0, v)) * BYTE).toString(16).padStart(2, '0')).join('')}`;

const matrixOf = (m: Affine) => m.map(num).join(' ');

const pointsOf = (c: number[]) => Array.from({ length: c.length / 2 }, (_, k) => `${num(c[2 * k])} ${num(c[2 * k + 1])}`);

const pathData = (contours: number[][]) => contours.map((c) => `M${pointsOf(c).join('L')}Z`).join('');

const isIdentity = (m: Affine) => m.every((v, i) => v === IDENTITY[i]);

const opacityAttr = (value: number) => (value < 1 ? ` opacity="${num(value)}"` : '');

class Skip {
  constructor(readonly why: string) {}
}

const reason = (why: string): string => {
  throw new Skip(why);
};

function stops(list: { at: number; color: Rgba }[]): string {
  return list.map((s) => `<stop offset="${num(s.at)}" stop-color="${hex(s.color)}"${s.color[3] < 1 ? ` stop-opacity="${num(s.color[3])}"` : ''}/>`).join('');
}

function paintAttr(w: Writer, paint: Paint): string {
  if (paint.kind === PaintKind.Solid) {
    return `fill="${hex(paint.color)}"${paint.color[3] < 1 ? ` fill-opacity="${num(paint.color[3])}"` : ''}`;
  }
  if (paint.kind === PaintKind.Sweep || paint.kind === PaintKind.Diamond) {
    return reason(`${paint.kind} gradient`);
  }
  const id = w.nextId('g');
  if (paint.kind === PaintKind.Linear) {
    w.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(paint.from[0])}" y1="${num(paint.from[1])}" x2="${num(paint.to[0])}" y2="${num(paint.to[1])}">${stops(paint.stops)}</linearGradient>`);
  } else {
    w.defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${num(paint.center[0])}" cy="${num(paint.center[1])}" r="${num(paint.radius)}">${stops(paint.stops)}</radialGradient>`);
  }
  return `fill="url(#${id})"`;
}

function pathMarkup(w: Writer, item: PathItem): string {
  const matrix = ` transform="matrix(${matrixOf(item.matrix)})"`;
  const rule = item.rule === FillRule.EvenOdd ? ' fill-rule="evenodd"' : '';
  const within = item.within ? clipWithin(w, item.within) : '';
  return `<path d="${pathData(item.contours)}" ${paintAttr(w, item.paint)}${rule}${matrix}${within}/>`;
}

function clipWithin(w: Writer, within: NonNullable<PathItem['within']>): string {
  const id = w.nextId('c');
  const outer = within.outside ? `M${-WIDE} ${-WIDE}H${WIDE}V${WIDE}H${-WIDE}Z` : '';
  w.defs.push(`<clipPath id="${id}"><path d="${outer}${pathData(within.contours)}" clip-rule="${within.outside ? 'evenodd' : 'nonzero'}"/></clipPath>`);
  return ` clip-path="url(#${id})"`;
}

function imageMarkup(w: Writer, item: ImageItem): string {
  const data = w.options.images.get(item.src);
  const fit = FIT[item.fit];
  const framed = item.zoom === 1 && item.focus[0] === CENTRE && item.focus[1] === CENTRE && isIdentity(item.inner);
  if (!data) {
    return reason(`picture not available (${item.src})`);
  }
  if (!fit || !framed || !item.clipped) {
    return reason(`picture framing ${item.fit}`);
  }
  const { width, height } = item.size;
  return `<image href="${data}" x="0" y="0" width="${num(width)}" height="${num(height)}" preserveAspectRatio="${fit}" transform="matrix(${matrixOf(item.matrix)})"/>`;
}

function maskShade(layer: MaskLayer): { outside: number; inside: number } {
  const coverage = (inside: number) => layer.level * (layer.invert ? 1 - inside : inside);
  const shade = (v: number) => (layer.mode === MaskMode.Subtract ? 1 - v : v);
  return { outside: shade(coverage(0)), inside: shade(coverage(1)) };
}

function gray(v: number): string {
  const c = Math.round(Math.min(1, Math.max(0, v)) * BYTE);
  return `rgb(${c},${c},${c})`;
}

function maskOf(w: Writer, layer: MaskLayer): string {
  const cover = layer.cover;
  if (cover.kind !== CoverKind.Path) {
    return reason(`${cover.kind} mask`);
  }
  if (layer.feather > 0) {
    return reason('feathered mask');
  }
  const { outside, inside } = maskShade(layer);
  const id = w.nextId('m');
  const shape = `<path d="${pathData(cover.contours)}" transform="matrix(${matrixOf(cover.matrix)})" fill="${gray(inside)}"/>`;
  w.defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w.frame.width}" height="${w.frame.height}"><rect width="${w.frame.width}" height="${w.frame.height}" fill="${gray(outside)}"/>${shape}</mask>`);
  return id;
}

const PRODUCT_MODES: ReadonlySet<MaskMode> = new Set([MaskMode.Intersect, MaskMode.Subtract]);

function masked(w: Writer, layers: MaskLayer[], inner: string): string {
  const productForm = layers.slice(1).every((l) => PRODUCT_MODES.has(l.mode));
  const allAdd = layers.every((l) => l.mode === MaskMode.Add && !l.invert);
  if (!productForm && !(allAdd && layers.length > 1)) {
    return reason('mask stack');
  }
  if (allAdd && layers.length > 1) {
    const ids = layers.map((l) => maskOf(w, l));
    const id = w.nextId('m');
    const union = ids.map((m) => `<g mask="url(#${m})"><rect width="${w.frame.width}" height="${w.frame.height}" fill="#fff"/></g>`).join('');
    w.defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w.frame.width}" height="${w.frame.height}">${union}</mask>`);
    return `<g mask="url(#${id})">${inner}</g>`;
  }
  return layers.reduceRight((markup, layer) => `<g mask="url(#${maskOf(w, layer)})">${markup}</g>`, inner);
}

function dressed(w: Writer, item: Item, inner: string, opacity: number): string {
  let out = inner;
  if (item.masks?.length) {
    out = masked(w, item.masks, out);
  }
  if (item.scissor) {
    const [x0, y0, x1, y1] = item.scissor;
    const id = w.nextId('c');
    w.defs.push(`<clipPath id="${id}"><rect x="${num(x0)}" y="${num(y0)}" width="${num(x1 - x0)}" height="${num(y1 - y0)}"/></clipPath>`);
    out = `<g clip-path="url(#${id})">${out}</g>`;
  }
  if (item.blur > 0) {
    const id = w.nextId('f');
    w.defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${num(item.blur)}"/></filter>`);
    out = `<g filter="url(#${id})">${out}</g>`;
  }
  return opacity < 1 ? `<g${opacityAttr(opacity)}>${out}</g>` : out;
}

const KIND_GAP: Partial<Record<ItemKind, string>> = {
  [ItemKind.Layer]: 'live layer',
  [ItemKind.Lens]: 'lens',
  [ItemKind.Glyphs]: 'font glyphs',
  [ItemKind.Text]: 'native text'
};

function body(w: Writer, item: Item): string {
  if (item.kind === ItemKind.Path) {
    return pathMarkup(w, item);
  }
  if (item.kind === ItemKind.Image) {
    return imageMarkup(w, item);
  }
  if (item.kind === ItemKind.Group) {
    return `<g${!isIdentity(item.matrix) ? ` transform="matrix(${matrixOf(item.matrix)})"` : ''}>${item.items.map((i) => itemMarkup(w, i)).join('')}</g>`;
  }
  return reason(KIND_GAP[item.kind] ?? item.kind);
}

function itemMarkup(w: Writer, item: Item): string {
  try {
    const gap = commonGap(item);
    if (gap) {
      return reason(gap);
    }
    return dressed(w, item, body(w, item), item.opacity);
  } catch (error) {
    if (!(error instanceof Skip)) {
      throw error;
    }
    w.skipped.push(`${item.clip}: ${error.why}`);
    return '';
  }
}

export function svgOf(list: DisplayList, options: SvgOptions): SvgResult {
  const frame = { width: list.width, height: list.height };
  const box = options.crop ?? { left: 0, top: 0, ...frame };
  let counter = 0;
  const w: Writer = { defs: [], skipped: [], nextId: (prefix) => `${prefix}${++counter}`, options, frame };
  const background = list.background ? `<rect width="${frame.width}" height="${frame.height}" fill="${hex(list.background)}"${list.background[3] < 1 ? ` fill-opacity="${num(list.background[3])}"` : ''}/>` : '';
  const drawn = list.items.map((item) => itemMarkup(w, item)).join('');
  const gaps = list.unsupported.map((g) => `${g.clip} (${g.component}): ${g.detail ?? g.reason}`);
  const defs = w.defs.length ? `<defs>${w.defs.join('')}</defs>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(box.width * options.scale)}" height="${Math.round(box.height * options.scale)}" viewBox="${num(box.left)} ${num(box.top)} ${num(box.width)} ${num(box.height)}">${defs}${background}${drawn}</svg>`;
  return { svg, skipped: [...gaps, ...w.skipped] };
}

function flatItems(items: readonly Item[]): Item[] {
  return items.flatMap((i) => (i.kind === ItemKind.Group ? [i, ...flatItems(i.items)] : [i]));
}

export function imageSources(list: DisplayList): string[] {
  return [...new Set(flatItems(list.items).flatMap((i) => (i.kind === ItemKind.Image ? [i.src] : [])))];
}

const cornersOf = (item: Item): [number, number][] => {
  if (item.kind === ItemKind.Path) {
    return item.contours.flatMap((c) => Array.from({ length: c.length / 2 }, (_, k) => apply2d(item.matrix, [c[2 * k], c[2 * k + 1]])));
  }
  if (item.kind === ItemKind.Image) {
    const { width, height } = item.size;
    return [[0, 0], [width, 0], [width, height], [0, height]].map((p) => apply2d(item.matrix, p as [number, number]));
  }
  return [];
};

export function boundsOfClips(list: DisplayList, clips: ReadonlySet<string>): Crop | null {
  const points = flatItems(list.items).filter((i) => clips.has(i.clip)).flatMap(cornersOf);
  if (!points.length) {
    return null;
  }
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [left, top] = [Math.min(...xs), Math.min(...ys)];
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}
