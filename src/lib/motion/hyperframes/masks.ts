import type { Keyframes } from '../keyframes';
import { MASK_KEYS, MaskKind, MaskMode, maskValue, type Mask, type MaskKey } from '../mask';
import { esc } from './html';
import { SANS } from './templates';

type Frame = { width: number; height: number };

export enum MaskScope {
  Own = 'm',
  Matte = 't'
}

const WRAPPER: Record<MaskScope, string> = { [MaskScope.Own]: 'km', [MaskScope.Matte]: 'kt' };

enum Part {
  X = 'x',
  Y = 'y',
  Rotate = 'r',
  Width = 'w',
  Height = 'h',
  Opacity = 'o',
  Dilate = 'e',
  Erode = 'n',
  Blur = 'b'
}

const UNIT = 100;
const HALF = UNIT / 2;

export type MaskAttr = { part: Part; attr: string; out: (value: number, frame: Frame) => number | string };

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export const MASK_LANES: Record<MaskKey, MaskAttr[]> = {
  maskX: [{ part: Part.X, attr: 'transform', out: (v, f) => `translate(${round(v * f.width)} 0)` }],
  maskY: [{ part: Part.Y, attr: 'transform', out: (v, f) => `translate(0 ${round(v * f.height)})` }],
  maskRotation: [{ part: Part.Rotate, attr: 'transform', out: (v) => `rotate(${round(v)})` }],
  maskWidth: [{ part: Part.Width, attr: 'transform', out: (v, f) => `scale(${round((v * f.width) / UNIT)} 1)` }],
  maskHeight: [{ part: Part.Height, attr: 'transform', out: (v, f) => `scale(1 ${round((v * f.height) / UNIT)})` }],
  maskOpacity: [{ part: Part.Opacity, attr: 'opacity', out: round }],
  maskFeather: [{ part: Part.Blur, attr: 'stdDeviation', out: round }],
  maskExpansion: [
    { part: Part.Dilate, attr: 'radius', out: (v) => round(Math.max(v, 0)) },
    { part: Part.Erode, attr: 'radius', out: (v) => round(Math.max(-v, 0)) }
  ]
};

export function maskTarget(scope: MaskScope | string, part: Part | string, clipId: string): string {
  return `${scope}${part}-${clipId}`;
}

export type MaskValues = Record<MaskKey, number>;

export function startValues(mask: Mask, keyframes: Keyframes): MaskValues {
  return Object.fromEntries(MASK_KEYS.map((key) => [key, Number(keyframes[key]?.[0]?.value ?? maskValue(mask, key))])) as MaskValues;
}

type Paint = { id: (part: string) => string; fill: string; level: number; mask: Mask; url: string | null };

const SHOWN = { fill: '#fff', level: 1 };
const CUT = { fill: '#000', level: 0 };

const BOX = `x="-${HALF}" y="-${HALF}" width="${UNIT}" height="${UNIT}"`;
const ELLIPSE = `rx="${HALF}" ry="${HALF}"`;
const STOPS = (fill: string) => `<stop offset="0" stop-color="${fill}" stop-opacity="1"/><stop offset="1" stop-color="${fill}" stop-opacity="0"/>`;

const ALPHA_ROW = '0 0 0 1 0';
const LUMA_ROW = '0.2125 0.7154 0.0721 0 0';

const assetFilter = ({ id, level }: Paint, alpha: string) =>
  `<filter id="${id('a')}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${level} 0 0 0 0 ${level} 0 0 0 0 ${level} ${alpha}"/></filter>`;

const picture = (p: Paint) => (p.url ? `<image href="${esc(p.url)}" ${BOX} preserveAspectRatio="none" filter="url(#${p.id('a')})"/>` : '');

const KIND: Record<MaskKind, { shape: (p: Paint) => string; defs: (p: Paint) => string }> = {
  [MaskKind.Rect]: { shape: (p) => `<rect ${BOX} fill="${p.fill}"/>`, defs: () => '' },
  [MaskKind.Ellipse]: { shape: (p) => `<ellipse ${ELLIPSE} fill="${p.fill}"/>`, defs: () => '' },
  [MaskKind.Polygon]: {
    shape: (p) => `<polygon points="${p.mask.points.map(([x, y]) => `${round(x * UNIT - HALF)},${round(y * UNIT - HALF)}`).join(' ')}" fill="${p.fill}"/>`,
    defs: () => ''
  },
  [MaskKind.Image]: { shape: picture, defs: (p) => assetFilter(p, ALPHA_ROW) },
  [MaskKind.Luma]: { shape: picture, defs: (p) => assetFilter(p, LUMA_ROW) },
  [MaskKind.Text]: {
    shape: (p) =>
      `<text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-family="${esc(SANS)}" font-weight="600" font-size="${UNIT * 0.8}" textLength="${UNIT}" lengthAdjust="spacingAndGlyphs" fill="${p.fill}">${esc(p.mask.text.replace(/\s*\n\s*/g, ' '))}</text>`,
    defs: () => ''
  },
  [MaskKind.Linear]: {
    shape: (p) => `<rect ${BOX} fill="url(#${p.id('g')})"/>`,
    defs: (p) => `<linearGradient id="${p.id('g')}" gradientUnits="userSpaceOnUse" x1="-${HALF}" y1="0" x2="${HALF}" y2="0">${STOPS(p.fill)}</linearGradient>`
  },
  [MaskKind.Radial]: {
    shape: (p) => `<ellipse ${ELLIPSE} fill="url(#${p.id('g')})"/>`,
    defs: (p) => `<radialGradient id="${p.id('g')}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${HALF}">${STOPS(p.fill)}</radialGradient>`
  }
};

const NESTING: Part[] = [Part.X, Part.Y, Part.Rotate, Part.Width, Part.Height];

const LANE_OF_PART = new Map(
  (Object.entries(MASK_LANES) as [MaskKey, MaskAttr[]][]).flatMap(([key, attrs]) => attrs.map((a) => [a.part, { key, attr: a }] as const))
);

export enum CssComposite {
  Add = 'add',
  Subtract = 'subtract',
  Intersect = 'intersect',
  Exclude = 'exclude'
}

type StackLayer = { composite: CssComposite; flip: boolean };

const AS_CSS: Record<MaskMode, StackLayer> = {
  [MaskMode.Add]: { composite: CssComposite.Add, flip: false },
  [MaskMode.Subtract]: { composite: CssComposite.Intersect, flip: true },
  [MaskMode.Intersect]: { composite: CssComposite.Intersect, flip: false },
  [MaskMode.Difference]: { composite: CssComposite.Exclude, flip: false }
};

export function stackLayers(modes: MaskMode[]): StackLayer[] {
  return modes.map((mode) => AS_CSS[mode]);
}

export type MaskShape = { mask: Mask; values: MaskValues; url: string | null };

export type MaskLayer = { scope: MaskScope; clipId: string; masks: MaskShape[]; frame: Frame };

const stackScope = (scope: MaskScope, index: number) => (index === 0 ? scope : `${scope}${index}`);

function maskDefs(scope: string, clipId: string, shape: MaskShape, flip: boolean, frame: Frame): string {
  const { mask, values } = shape;
  const id = (part: string) => maskTarget(scope, part, clipId);
  const value = (part: Part) => {
    const lane = LANE_OF_PART.get(part)!;
    return `${lane.attr.attr}="${lane.attr.out(values[lane.key], frame)}"`;
  };
  const set = (part: Part) => `id="${id(part)}" ${value(part)}`;
  const inverted = mask.invert !== flip;
  const paint: Paint = { id, ...(inverted ? CUT : SHOWN), mask, url: shape.url };
  const region = `x="${-frame.width}" y="${-frame.height}" width="${frame.width * 3}" height="${frame.height * 3}"`;

  const kind = KIND[mask.kind];
  const nested = NESTING.reduceRight((body, part) => `<g ${set(part)}>${body}</g>`, kind.shape(paint));
  const filter = `<filter id="${id('f')}" filterUnits="userSpaceOnUse" ${region}><feMorphology id="${id(Part.Dilate)}" operator="dilate" ${value(Part.Dilate)}/><feMorphology id="${id(Part.Erode)}" operator="erode" ${value(Part.Erode)}/><feGaussianBlur ${set(Part.Blur)}/></filter>`;
  const backdrop = inverted ? `<rect ${region} fill="#fff"/>` : '';
  return `${filter}${kind.defs(paint)}<mask id="${id('k')}" maskUnits="userSpaceOnUse" ${region}>${backdrop}<g filter="url(#${id('f')})"><g ${set(Part.Opacity)}>${nested}</g></g></mask>`;
}

export function maskLayer(layer: MaskLayer, inner: string): string {
  const { scope, clipId, masks, frame } = layer;
  const layers = stackLayers(masks.map((m) => m.mask.mode));
  const topFirst = masks.map((shape, i) => ({ shape, scope: stackScope(scope, i), layer: layers[i] })).reverse();

  const defs = topFirst.map((m) => maskDefs(m.scope, clipId, m.shape, m.layer.flip, frame)).join('');
  const url = topFirst.map((m) => `url(#${maskTarget(m.scope, 'k', clipId)})`).join(',');
  const composite = masks.length > 1 ? `;mask-composite:${topFirst.map((m) => m.layer.composite).join(',')}` : '';
  const wrapper = WRAPPER[scope];

  return `<svg class="kd" aria-hidden="true"><defs>${defs}</defs></svg><div class="${wrapper}" id="${wrapper}-${clipId}" style="mask:${url};-webkit-mask:${url}${composite}">${inner}</div>`;
}

export const MASK_CSS = '.km,.kt{position:absolute;inset:0}.kd{position:absolute;width:0;height:0;overflow:hidden}';

export async function freezeMasks(): Promise<() => void> {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const asData = (url: string) =>
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => new Promise<string>((resolve) => Object.assign(new FileReader(), { onload: (e: ProgressEvent<FileReader>) => resolve(String(e.target?.result)) }).readAsDataURL(blob)));
  const undo: (() => void)[] = [];

  const freezeOne = async (defs: Element, mask: Element, width: number, height: number) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = `<filter id="kl" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" color-interpolation-filters="sRGB"><feColorMatrix type="luminanceToAlpha" result="l"/><feComposite in="l" in2="SourceGraphic" operator="in"/></filter>`;

    const copy = defs.cloneNode(true) as Element;
    copy.querySelectorAll('mask').forEach((m) => m.remove());
    const body = document.createElementNS(SVG_NS, 'g');
    body.setAttribute('filter', 'url(#kl)');
    body.append(...Array.from(mask.cloneNode(true).childNodes));
    svg.append(copy, body);

    for (const image of Array.from(svg.querySelectorAll('image'))) {
      const href = image.getAttribute('href');
      if (href && !href.startsWith('data:')) {
        image.setAttribute('href', await asData(href).catch(() => href));
      }
    }
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}") 0 0 / 100% 100% no-repeat`;
  };

  for (const el of Array.from(document.querySelectorAll<HTMLElement>('.km,.kt'))) {
    const defs = el.previousElementSibling?.querySelector('defs');
    const masks = Array.from(defs?.querySelectorAll('mask') ?? []);
    if (!defs || !masks.length) {
      continue;
    }

    const before = el.getAttribute('style') ?? '';
    const composite = getComputedStyle(el).getPropertyValue('mask-composite');
    const frozen = (await Promise.all(masks.map((mask) => freezeOne(defs, mask, el.offsetWidth, el.offsetHeight)))).join(',');
    el.style.setProperty('mask', frozen);
    el.style.setProperty('-webkit-mask', frozen);
    el.style.setProperty('mask-composite', composite);
    undo.push(() => el.setAttribute('style', before));
  }

  return () => undo.forEach((restore) => restore());
}
