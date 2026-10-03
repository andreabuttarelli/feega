import type { Keyframes } from '../keyframes';
import { MASK_KEYS, MaskKind, maskValue, type Mask, type MaskKey } from '../mask';
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

export function maskTarget(scope: MaskScope, part: Part | string, clipId: string): string {
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

export type MaskLayer = { scope: MaskScope; clipId: string; mask: Mask; values: MaskValues; frame: Frame; url: string | null };

export function maskLayer(layer: MaskLayer, inner: string): string {
  const { scope, clipId, mask, values, frame } = layer;
  const id = (part: string) => maskTarget(scope, part, clipId);
  const value = (part: Part) => {
    const lane = LANE_OF_PART.get(part)!;
    return `${lane.attr.attr}="${lane.attr.out(values[lane.key], frame)}"`;
  };
  const set = (part: Part) => `id="${id(part)}" ${value(part)}`;
  const paint: Paint = { id, ...(mask.invert ? CUT : SHOWN), mask, url: layer.url };
  const region = `x="${-frame.width}" y="${-frame.height}" width="${frame.width * 3}" height="${frame.height * 3}"`;

  const kind = KIND[mask.kind];
  const nested = NESTING.reduceRight((body, part) => `<g ${set(part)}>${body}</g>`, kind.shape(paint));
  const filter = `<filter id="${id('f')}" filterUnits="userSpaceOnUse" ${region}><feMorphology id="${id(Part.Dilate)}" operator="dilate" ${value(Part.Dilate)}/><feMorphology id="${id(Part.Erode)}" operator="erode" ${value(Part.Erode)}/><feGaussianBlur ${set(Part.Blur)}/></filter>`;
  const backdrop = mask.invert ? `<rect ${region} fill="#fff"/>` : '';
  const svg = `<svg class="kd" aria-hidden="true"><defs>${filter}${kind.defs(paint)}<mask id="${id('k')}" maskUnits="userSpaceOnUse" ${region}>${backdrop}<g filter="url(#${id('f')})"><g ${set(Part.Opacity)}>${nested}</g></g></mask></defs></svg>`;
  const url = `url(#${id('k')})`;
  const wrapper = WRAPPER[scope];

  return `${svg}<div class="${wrapper}" id="${wrapper}-${clipId}" style="mask:${url};-webkit-mask:${url}">${inner}</div>`;
}

export const MASK_CSS = '.km,.kt{position:absolute;inset:0}.kd{position:absolute;width:0;height:0;overflow:hidden}';
