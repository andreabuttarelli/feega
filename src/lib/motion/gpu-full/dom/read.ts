import { apply2d, mul2d, type Affine } from '../../affine';
import { invert2d } from '../../parent';
import { ellipseOutline, flatten, parsePath, rectOutline, type Outline } from '../../shape/geometry';
import { FillRule, MAX_STOPS, PaintKind, type Paint } from '../paint';
import { rgbaOf, type Rgba } from '../rgba';
import { cornerOf, isNone, lengthOf, linearGradient, splitTop, tileOf, transformOf, type Gradient, type Size } from './css';
import { NO_INDEX, type RawNode, type RawTree, type TextLine } from './tree';
import { Ligatures } from '../text/face';
import { glyphContours, moved, NO_TYPESET, SMOOTHING, Smoothing, type Typeset } from '../text/painter';
import type { SvgNode } from '../../effects/registry';
import { BlendMode } from '../../blend';
import { MaskMode } from '../../mask';
import { CoverKind, type MaskLayer } from '../mask-layers';
import { PaintGap, svgFill, svgStroke, type Fill } from './svg-paint';
import { cssFunctions, FilterKind, unsupportedPrimitive, type Filter, type Linear } from '../filters';

export enum DomGap {
  Text = 'text',
  Font = 'font',
  Media = 'media',
  Element = 'element',
  Filter = 'filter',
  Blend = 'blend',
  Mask = 'mask',
  Clip = 'overflow-clip',
  Opacity = 'group-opacity',
  Order = 'z-index',
  Transform = 'transform',
  Shadow = 'shadow',
  Stroke = 'stroke',
  Paint = 'paint',
  Background = 'background',
  Border = 'border',
  Radius = 'radius',
  Geometry = 'geometry'
}

export enum DrawnKind {
  Path = 'path',
  Layer = 'layer',
  Group = 'group'
}

export type Look = { masks?: MaskLayer[]; filters?: Filter[]; space?: Linear; blend?: BlendMode };
export type DrawnPath = { kind: DrawnKind.Path; contours: number[][]; rule: FillRule; paint: Paint; opacity: number; matrix: Affine } & Look;
export type DrawnLayer = { kind: DrawnKind.Layer; layer: number; width: number; height: number; opacity: number; matrix: Affine } & Look;
export type DrawnGroup = { kind: DrawnKind.Group; items: Drawn[]; opacity: number; matrix: Affine } & Look;
export type Drawn = DrawnPath | DrawnLayer | DrawnGroup;
export type DomGapCount = { element: string; reason: DomGap; count: number };
export type DomRead = { drawn: Drawn[]; gaps: DomGapCount[] };

type Own = { drawn: Drawn[]; gaps: DomGap[] };
type Scope = { matrix: Affine; viewport: Size; typeset: Typeset; defs: RawTree['defs'] };
type Style = RawNode['style'];
type BoxShape = { round: true; radii: number[] } | { round: false; ellipse: true };
type Painter = (node: RawNode, scope: Scope) => Own;

const CASES: Record<string, (c: string) => string> = { '': (c) => c, none: (c) => c, uppercase: (c) => c.toUpperCase(), lowercase: (c) => c.toLowerCase() };
const ITALIC = new Set(['italic', 'oblique']);
const REGULAR = 400;
const GRAYSCALE = new Set(['antialiased', 'none']);
const SPILL_TOLERANCE = 0.5;
const UNIT_EPSILON = 1e-6;
const HIDDEN = new Set(['hidden', 'collapse']);
const CLIPPING = new Set(['hidden', 'clip', 'scroll', 'auto']);
const STATIC = new Set(['', 'static']);
const NO_Z = new Set(['', 'auto', '0']);
const PLAIN_BLEND = new Set(['', 'normal']);
const SOLID_BORDER = 'solid';
const NO_BORDER = new Set(['', 'none', 'hidden']);
const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;
const REPEAT = 'repeat';
const NO_REPEAT = 'no-repeat';
const ORIGIN_POSITIONS = new Set(['', '0% 0%', '0px 0px', 'left top']);

const REFUSALS: [DomGap, (s: Style) => boolean][] = [
  [DomGap.Filter, (s) => !isNone(s['backdrop-filter'])],
  [DomGap.Mask, (s) => !isNone(s['mask-image'])],
  [DomGap.Transform, (s) => transformOf(s.transform, s['transform-origin']) === null]
];

const flat = (outline: Outline, dx = 0, dy = 0): number[][] => outline.map((c) => flatten(c).flatMap(([x, y]) => [x + dx, y + dy]));
const opacityOf = (s: Style) => (s.opacity === undefined || s.opacity === '' ? 1 : Number(s.opacity));
const px = (v: string | undefined) => parseFloat(v ?? '') || 0;
const label = (node: RawNode) => node.tag + (node.attrs.class ? `.${node.attrs.class.trim().split(/\s+/)[0]}` : '');
const solid = (color: [number, number, number, number]): Paint => ({ kind: PaintKind.Solid, color });
const path = (contours: number[][], paint: Paint, matrix: Affine, rule = FillRule.NonZero, opacity = 1): DrawnPath => ({ kind: DrawnKind.Path, contours, rule, paint, opacity, matrix });
const nothing = (...gaps: DomGap[]): Own => ({ drawn: [], gaps });

function boxShapeOf(s: Style, size: Size): BoxShape | null {
  const corners = CORNERS.map((c) => cornerOf(s[`border-${c}-radius`], size));
  if (corners.some((c) => c === null)) {
    return null;
  }
  const [tl, tr, br, bl] = corners as [number, number][];
  const scale = Math.min(1, ...[[tl[0] + tr[0], size.w], [bl[0] + br[0], size.w], [tl[1] + bl[1], size.h], [tr[1] + br[1], size.h]].map(([sum, side]) => (sum > 0 ? side / sum : 1)));
  const scaled = [tl, tr, br, bl].map(([x, y]) => [x * scale, y * scale]);
  if (scaled.every(([x, y]) => Math.abs(x - y) < UNIT_EPSILON)) {
    return { round: true, radii: scaled.map(([x]) => x) };
  }
  const elliptical = scaled.every(([x, y]) => Math.abs(x - size.w / 2) < UNIT_EPSILON && Math.abs(y - size.h / 2) < UNIT_EPSILON);
  return elliptical ? { round: false, ellipse: true } : null;
}

function outlineOf(shape: BoxShape, size: Size): Outline {
  if (!shape.round) {
    return ellipseOutline(size);
  }
  const side = Math.min(size.w, size.h);
  return rectOutline(shape.radii.map((r) => (side > 0 ? r / side : 0)) as [number, number, number, number], size);
}

const squared = (shape: BoxShape) => shape.round && shape.radii.every((r) => r === 0);

type Band = { color: Rgba; contours: number[][] };

const sameColour = (a: Rgba, b: Rgba) => a.every((v, i) => Math.abs(v - b[i]) < UNIT_EPSILON);

function bandsOf(gradient: Gradient, tile: Size, tiles: [number, number][], size: Size): Band[] | null {
  const { from, to, stops } = gradient;
  const vertical = Math.abs(from[0] - to[0]) < UNIT_EPSILON;
  const horizontal = Math.abs(from[1] - to[1]) < UNIT_EPSILON;
  const constant = stops.every((stop, i) => i === 0 || stop.at - stops[i - 1].at < UNIT_EPSILON || sameColour(stop.color, stops[i - 1].color));
  if ((!vertical && !horizontal) || !constant) {
    return null;
  }
  const along = vertical ? 1 : 0;
  const ends = [-Infinity, ...stops.map((st) => st.at), Infinity];
  const spans = stops.map((stop, i) => ({ color: stop.color, t0: i === 0 ? ends[0] : stops[i - 1].at, t1: stop.at })).concat({ color: stops[stops.length - 1].color, t0: stops[stops.length - 1].at, t1: ends[ends.length - 1] });
  const coord = (t: number) => from[along] + Math.max(-1e6, Math.min(1e6, t)) * (to[along] - from[along]);
  const bands = new Map<string, Band>();
  for (const span of spans) {
    if (span.color[3] <= 0 || span.t1 - span.t0 < UNIT_EPSILON) {
      continue;
    }
    const [a, b] = [coord(span.t0), coord(span.t1)].sort((p, q) => p - q);
    const band = bands.get(span.color.join()) ?? bands.set(span.color.join(), { color: span.color, contours: [] }).get(span.color.join())!;
    for (const [x, y] of tiles) {
      const box = { x0: x, y0: y, x1: Math.min(x + tile.w, size.w), y1: Math.min(y + tile.h, size.h) };
      const [x0, x1] = vertical ? [box.x0, box.x1] : [Math.max(box.x0, x + a), Math.min(box.x1, x + b)];
      const [y0, y1] = vertical ? [Math.max(box.y0, y + a), Math.min(box.y1, y + b)] : [box.y0, box.y1];
      if (x1 > x0 && y1 > y0) {
        band.contours.push([x0, y0, x1, y0, x1, y1, x0, y1]);
      }
    }
  }
  return [...bands.values()].filter((b) => b.contours.length);
}

function backgroundOf(s: Style, size: Size, shape: BoxShape, matrix: Affine): Own {
  const drawn: Drawn[] = [];
  const color = rgbaOf(s['background-color'] ?? '');
  if (color && color[3] > 0) {
    drawn.push(path(flat(outlineOf(shape, size)), solid(color), matrix));
  }
  if (isNone(s['background-image'])) {
    return { drawn, gaps: [] };
  }
  const images = splitTop(s['background-image'] ?? '');
  const sizes = splitTop(s['background-size'] ?? 'auto');
  const positions = splitTop(s['background-position'] ?? '');
  const repeats = splitTop(s['background-repeat'] ?? REPEAT);
  const layers = images.map((image, i) => ({ image, tile: tileOf(sizes[i % sizes.length], size), position: positions[i % (positions.length || 1)] ?? '', repeat: repeats[i % repeats.length] }));
  const unsupported = layers.some((l) => !l.tile || !ORIGIN_POSITIONS.has(l.position) || (l.repeat !== REPEAT && l.repeat !== NO_REPEAT) || bordered(s));
  if (unsupported) {
    return { drawn, gaps: [DomGap.Background] };
  }
  for (const layer of [...layers].reverse()) {
    const tile = layer.tile as Size;
    const gradient = linearGradient(layer.image, tile);
    if (!gradient || gradient.stops.length > MAX_STOPS) {
      return { drawn, gaps: [DomGap.Background] };
    }
    const single = layer.repeat === NO_REPEAT || (tile.w >= size.w && tile.h >= size.h);
    if (!single && !squared(shape)) {
      return { drawn, gaps: [DomGap.Radius] };
    }
    const tiles = single ? [[0, 0]] : grid(size, tile);
    const bands = squared(shape) ? bandsOf(gradient, tile, tiles as [number, number][], size) : null;
    if (bands) {
      drawn.push(...bands.map((b) => path(b.contours, solid(b.color), matrix)));
      continue;
    }
    for (const [x, y] of tiles) {
      const contours = single ? flat(outlineOf(shape, { w: Math.min(tile.w, size.w), h: Math.min(tile.h, size.h) })) : [[x, y, Math.min(x + tile.w, size.w), y, Math.min(x + tile.w, size.w), Math.min(y + tile.h, size.h), x, Math.min(y + tile.h, size.h)]];
      const paint: Paint = { kind: PaintKind.Linear, from: [gradient.from[0] + x, gradient.from[1] + y], to: [gradient.to[0] + x, gradient.to[1] + y], stops: gradient.stops };
      drawn.push(path(contours, paint, matrix));
    }
  }
  return { drawn, gaps: [] };
}

function grid(size: Size, tile: Size): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < size.h - UNIT_EPSILON; y += tile.h) {
    for (let x = 0; x < size.w - UNIT_EPSILON; x += tile.w) {
      out.push([x, y]);
    }
  }
  return out;
}

type Side = { width: number; style: string; color: string };

const sidesOf = (s: Style): Side[] => SIDES.map((side) => ({ width: NO_BORDER.has(s[`border-${side}-style`] ?? '') ? 0 : px(s[`border-${side}-width`]), style: s[`border-${side}-style`] ?? '', color: s[`border-${side}-color`] ?? '' }));

const bordered = (s: Style) => sidesOf(s).some((side) => side.width > 0);

function borderOf(s: Style, size: Size, shape: BoxShape, matrix: Affine): Own {
  const sides = sidesOf(s);
  const drawn = sides.filter((side) => side.width > 0);
  if (!drawn.length) {
    return nothing();
  }
  const color = rgbaOf(drawn[0].color);
  if (!color || drawn.some((side) => side.style !== SOLID_BORDER || side.color !== drawn[0].color)) {
    return nothing(DomGap.Border);
  }
  const [top, right, bottom, left] = sides.map((side) => side.width);
  const inner: Size = { w: Math.max(0, size.w - left - right), h: Math.max(0, size.h - top - bottom) };
  const uniform = sides.every((side) => side.width === top);
  if (!squared(shape) && !uniform) {
    return nothing(DomGap.Border);
  }
  const innerShape: BoxShape = shape.round ? { round: true, radii: shape.radii.map((r) => Math.max(0, r - top)) } : shape;
  const contours = [...flat(outlineOf(shape, size)), ...flat(outlineOf(innerShape, inner), left, top)];
  return { drawn: [path(contours, solid(color), matrix, FillRule.EvenOdd)], gaps: [] };
}

function pixelSnapped(m: Affine, size: Size): Affine {
  if (!upright(m) || size.w <= 0 || size.h <= 0) {
    return m;
  }
  const [x0, y0] = [Math.round(m[4]), Math.round(m[5])];
  const [x1, y1] = [Math.round(m[0] * size.w + m[4]), Math.round(m[3] * size.h + m[5])];
  return [(x1 - x0) / size.w, 0, 0, (y1 - y0) / size.h, x0, y0];
}

const SHADOW = /^((?:rgba?|hsla?)\([^)]*\)|#[0-9a-f]+|[a-z]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px(?:\s+(-?[\d.]+)px)?$/i;
const SHADOW_SIGMA = 0.5;

function shadowsOf(s: Style, size: Size, shape: BoxShape, matrix: Affine): Own {
  if (isNone(s['box-shadow'])) {
    return nothing();
  }
  const drawn: Drawn[] = [];
  for (const one of splitTop(s['box-shadow'] ?? '').reverse()) {
    const m = SHADOW.exec(one.trim());
    const color = m ? rgbaOf(m[1]) : null;
    if (!m || !color) {
      return nothing(DomGap.Shadow);
    }
    const [dx, dy, blur, spread] = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5] ?? 0)];
    const grown: Size = { w: Math.max(0, size.w + 2 * spread), h: Math.max(0, size.h + 2 * spread) };
    const grownShape: BoxShape = shape.round ? { round: true, radii: shape.radii.map((r) => Math.max(0, r + spread)) } : shape;
    if (color[3] <= 0 || !grown.w || !grown.h) {
      continue;
    }
    const filters: Filter[] = blur > 0 ? [{ kind: FilterKind.Css, fns: [{ name: 'blur', args: [`${blur * SHADOW_SIGMA}px`] }] }] : [];
    drawn.push({ ...path(flat(outlineOf(grownShape, grown), dx - spread, dy - spread), solid(color), matrix), ...(filters.length ? { filters, space: linearOf(matrix) } : {}) });
  }
  return { drawn, gaps: [] };
}

const boxPainter: Painter = (node, scope) => {
  const size = { w: node.size[0], h: node.size[1] };
  const shape = boxShapeOf(node.style, size);
  if (!shape) {
    return nothing(DomGap.Radius);
  }
  const matrix = pixelSnapped(scope.matrix, size);
  const background = backgroundOf(node.style, size, shape, matrix);
  const border = borderOf(node.style, size, shape, matrix);
  const shadow = shadowsOf(node.style, size, shape, matrix);
  return { drawn: [...shadow.drawn, ...background.drawn, ...border.drawn], gaps: [...shadow.gaps, ...background.gaps, ...border.gaps] };
};

const layerPainter: Painter = (node, scope) => {
  if (node.layer === NO_INDEX) {
    return nothing(DomGap.Media);
  }
  return { drawn: [{ kind: DrawnKind.Layer, layer: node.layer, width: node.size[0], height: node.size[1], opacity: 1, matrix: scope.matrix }], gaps: [] };
};

const groupPainter: Painter = () => nothing();
const mediaPainter: Painter = () => nothing(DomGap.Media);
const elementPainter: Painter = () => nothing(DomGap.Element);

type Geometry = (attrs: RawNode['attrs'], viewport: Size) => Outline | null;

const len = (attrs: RawNode['attrs'], key: keyof RawNode['attrs'], basis: number) => lengthOf(attrs[key], basis);

function numbers(...values: (number | null)[]): number[] | null {
  return values.some((v) => v === null || !Number.isFinite(v)) ? null : (values as number[]);
}

const pointsOf: Geometry = (attrs) => {
  const values = (attrs.points ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
  if (values.some((v) => !Number.isFinite(v))) {
    return null;
  }
  const pts = Array.from({ length: Math.floor(values.length / 2) }, (_, i) => [values[2 * i], values[2 * i + 1]] as const);
  return [{ vertices: pts.map((p) => ({ p, in: p, out: p })), closed: true }];
};

const shifted = (outline: Outline, dx: number, dy: number): Outline => outline.map((c) => ({ ...c, vertices: c.vertices.map((v) => ({ p: [v.p[0] + dx, v.p[1] + dy] as const, in: [v.in[0] + dx, v.in[1] + dy] as const, out: [v.out[0] + dx, v.out[1] + dy] as const })) }));

const rectOf: Geometry = (attrs, vp) => {
  const v = numbers(len(attrs, 'x', vp.w), len(attrs, 'y', vp.h), len(attrs, 'width', vp.w), len(attrs, 'height', vp.h));
  if (!v) {
    return null;
  }
  const [x, y, w, h] = v;
  const rxRaw = attrs.rx === undefined ? null : lengthOf(attrs.rx, vp.w);
  const ryRaw = attrs.ry === undefined ? null : lengthOf(attrs.ry, vp.h);
  const rx = Math.min(w / 2, rxRaw ?? ryRaw ?? 0);
  const ry = Math.min(h / 2, ryRaw ?? rxRaw ?? 0);
  if (w <= 0 || h <= 0) {
    return [];
  }
  if (Math.abs(rx - ry) > UNIT_EPSILON) {
    return Math.abs(rx - w / 2) < UNIT_EPSILON && Math.abs(ry - h / 2) < UNIT_EPSILON ? shifted(ellipseOutline({ w, h }), x, y) : null;
  }
  return shifted(rectOutline(rx / Math.min(w, h), { w, h }), x, y);
};

const circleOf: Geometry = (attrs, vp) => {
  const v = numbers(len(attrs, 'cx', vp.w), len(attrs, 'cy', vp.h), len(attrs, 'r', Math.hypot(vp.w, vp.h) / Math.SQRT2));
  return v ? shifted(ellipseOutline({ w: 2 * v[2], h: 2 * v[2] }), v[0] - v[2], v[1] - v[2]) : null;
};

const ellipseOf: Geometry = (attrs, vp) => {
  const v = numbers(len(attrs, 'cx', vp.w), len(attrs, 'cy', vp.h), len(attrs, 'rx', vp.w), len(attrs, 'ry', vp.h));
  return v ? shifted(ellipseOutline({ w: 2 * v[2], h: 2 * v[3] }), v[0] - v[2], v[1] - v[3]) : null;
};

const pathOf: Geometry = (attrs) => {
  try {
    const outline = parsePath(attrs.d ?? '');
    return typeof outline === 'string' ? null : outline;
  } catch {
    return null;
  }
};

const shapePainter =
  (geometry: Geometry): Painter =>
  (node, scope) => {
    const outline = geometry(node.attrs, scope.viewport);
    if (!outline) {
      return nothing(DomGap.Geometry);
    }
    const shape = { outline, matrix: scope.matrix, viewport: scope.viewport, rect: node.tag === 'rect' && !node.attrs.rx && !node.attrs.ry };
    const layers = [svgFill(node.style, scope.defs, shape), svgStroke(node.style, scope.defs, shape)];
    const drawn = layers.flatMap((l) => (typeof l === 'string' ? [] : l.map((f: Fill) => path(f.contours, f.paint, f.matrix, f.rule, f.opacity))));
    return { drawn, gaps: layers.filter((l): l is PaintGap => typeof l === 'string').map((l) => PAINT_GAP[l]) };
  };

const familyOf = (s: Style) => (splitTop(s['font-family'] ?? '')[0] ?? '').replace(/^["']|["']$/g, '');

const upright = (m: Affine) => Math.abs(m[1]) < UNIT_EPSILON && Math.abs(m[2]) < UNIT_EPSILON && Math.abs(m[3]) > UNIT_EPSILON;

const snapped = (y: number, m: Affine) => (upright(m) ? (Math.round(m[3] * y + m[5]) - m[5]) / m[3] : Math.round(y));

const SUBPIXEL_STEPS = 4;

const quartered = (x: number, m: Affine) => (upright(m) ? (Math.round((m[0] * x + m[4]) * SUBPIXEL_STEPS) / SUBPIXEL_STEPS - m[4]) / m[0] : x);

function textOf(node: RawNode, scope: Scope): Own {
  const s = node.style;
  const cased = CASES[s['text-transform'] ?? ''];
  const color = rgbaOf(s.color ?? '');
  if (node.raster) {
    const { layer, width, height } = node.raster;
    return { drawn: [{ kind: DrawnKind.Layer, layer, width, height, opacity: 1, matrix: mul2d(scope.matrix, [1, 0, 0, 1, ...node.raster.at]) }], gaps: [] };
  }
  if (!node.lines.length || !cased || !color) {
    return nothing(DomGap.Text);
  }
  const size = px(s['font-size']);
  const request = { family: familyOf(s), weight: Number(s['font-weight']) || REGULAR, italic: ITALIC.has(s['font-style'] ?? ''), size, axes: {} };
  const smoothing = SMOOTHING[GRAYSCALE.has(s['-webkit-font-smoothing'] ?? '') ? Smoothing.Plain : scope.typeset.smoothing];
  const drawn: Drawn[] = [];
  const gaps: DomGap[] = [];
  const glyph = (line: TextLine, char: string, x: number) => {
    const resolved = scope.typeset.fonts(request, char.codePointAt(0)!);
    if (!resolved) {
      gaps.push(DomGap.Font);
      return;
    }
    const { face, skew } = resolved;
    const baseline = snapped(line.top + Math.round((face.ascent * size) / face.unitsPerEm), scope.matrix) - smoothing.rise;
    const [shaped] = face.shape(char, Ligatures.Off);
    drawn.push(path(moved(glyphContours(face, shaped.glyph, size, skew, smoothing.darken(size)), x, baseline), solid(color), scope.matrix));
  };
  node.lines.forEach((line) => line.chars.forEach((c, i) => glyph(line, cased(c), quartered(line.xs[i], scope.matrix))));
  return { drawn, gaps };
}

const GEOMETRY: Record<string, Geometry> = { polygon: pointsOf, polyline: pointsOf, rect: rectOf, circle: circleOf, ellipse: ellipseOf, path: pathOf };

const REFERENCE = /^url\(\s*["']?#([^"')]+)["']?\s*\)$/;
const SPREADING = new Set(['feGaussianBlur', 'feColorMatrix', 'feComponentTransfer', 'feFuncR', 'feFuncG', 'feFuncB', 'feFuncA']);
const SPREADING_CSS = new Set(['blur', 'grayscale', 'brightness', 'contrast', 'saturate', 'hue-rotate', 'sepia', 'invert']);
const USER_SPACE = 'userSpaceOnUse';
const BLENDS = new Set<string>(Object.values(BlendMode));

type Defs = RawTree['defs'];
type Group = { node: RawNode; items: Drawn[]; matrix: Affine; viewport: Size; defs: Defs };
type GroupEffect = (group: Group) => Drawn[] | DomGap;

const referenced = (value: string | undefined, defs: Defs): SvgNode | null => {
  const id = REFERENCE.exec((value ?? '').trim())?.[1];
  return id ? (defs[id] ?? null) : null;
};

const linearOf = (m: Affine): Linear => [m[0], m[1], m[2], m[3]];

const textAttrs = (attrs: SvgNode['attrs']) => Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, String(v)])) as RawNode['attrs'];

function filterOf(value: string, defs: Defs): { filter: Filter; spreads: boolean } | null {
  const node = referenced(value, defs);
  if (node) {
    const steps = (node.children ?? []).flatMap((c) => [c, ...(c.children ?? [])]);
    return node.tag === 'filter' && !unsupportedPrimitive([node]) ? { filter: { kind: FilterKind.Svg, nodes: [node] }, spreads: steps.every((c) => SPREADING.has(c.tag)) } : null;
  }
  const fns = cssFunctions(value);
  return fns.length && !REFERENCE.test(value.trim()) ? { filter: { kind: FilterKind.Css, fns }, spreads: fns.every((f) => SPREADING_CSS.has(f.name)) } : null;
}

const clipEffect: GroupEffect = ({ node, items, matrix, viewport, defs }) => {
  const value = node.style['clip-path'];
  if (isNone(value)) {
    return items;
  }
  const inset = insetOf(value ?? '', { w: node.size[0], h: node.size[1] });
  if (inset) {
    return masked(items, { mode: MaskMode.Intersect, invert: false, level: 1, feather: 0, cover: { kind: CoverKind.Path, contours: [inset], matrix } });
  }
  const clip = referenced(value, defs);
  if (!clip || clip.tag.toLowerCase() !== 'clippath' || (clip.attrs.clipPathUnits ?? USER_SPACE) !== USER_SPACE) {
    return DomGap.Mask;
  }
  const outlines = (clip.children ?? []).map((c) => GEOMETRY[c.tag]?.(textAttrs(c.attrs), viewport) ?? null);
  if (outlines.some((o) => o === null)) {
    return DomGap.Mask;
  }
  return masked(items, { mode: MaskMode.Intersect, invert: false, level: 1, feather: 0, cover: { kind: CoverKind.Path, contours: (outlines as Outline[]).flatMap((o) => flat(o)), matrix } });
};

const masked = (items: Drawn[], mask: MaskLayer) => items.map((d) => ({ ...d, masks: [...(d.masks ?? []), mask] }));

const INSET = /^inset\(([^)]*)\)$/;

function insetOf(value: string, size: Size): number[] | null {
  const m = INSET.exec(value.trim());
  if (!m || m[1].includes('round')) {
    return null;
  }
  const parts = m[1].trim().split(/\s+/);
  const [t, r, b, l] = [parts[0], parts[1] ?? parts[0], parts[2] ?? parts[0], parts[3] ?? parts[1] ?? parts[0]];
  const v = numbers(lengthOf(t, size.h), lengthOf(r, size.w), lengthOf(b, size.h), lengthOf(l, size.w));
  if (!v) {
    return null;
  }
  const [x0, y0, x1, y1] = [v[3], v[0], size.w - v[1], size.h - v[2]];
  return x1 > x0 && y1 > y0 ? [x0, y0, x1, y0, x1, y1, x0, y1] : [];
}

const filterEffect: GroupEffect = ({ node, items, matrix, defs }) => {
  const value = node.style.filter;
  if (isNone(value)) {
    return items;
  }
  const found = filterOf(value ?? '', defs);
  if (!found || (items.length > 1 && !found.spreads)) {
    return DomGap.Filter;
  }
  const filter = regioned(found.filter, items);
  return items.map((d) => ({ ...d, filters: [...(d.filters ?? []), filter], space: linearOf(matrix) }));
};

const REGION_DEFAULTS = { x: '-10%', y: '-10%', width: '120%', height: '120%' };
const GENERATORS = new Set(['feTurbulence', 'feFlood']);

const LOCAL_POINTS: Record<DrawnKind, (d: never) => [number, number][]> = {
  [DrawnKind.Path]: (d: DrawnPath) => d.contours.flatMap((c) => Array.from({ length: c.length / 2 }, (_, i): [number, number] => [c[2 * i], c[2 * i + 1]])),
  [DrawnKind.Layer]: (d: DrawnLayer) => [[0, 0], [d.width, 0], [d.width, d.height], [0, d.height]],
  [DrawnKind.Group]: (d: DrawnGroup) => d.items.flatMap(worldPoints)
};

function worldPoints(d: Drawn): [number, number][] {
  return (LOCAL_POINTS[d.kind] as (d: Drawn) => [number, number][])(d).map((p) => apply2d(d.matrix, p));
}

function frameBox(items: Drawn[]): { x: number; y: number; w: number; h: number } | null {
  const points = items.flatMap(worldPoints);
  if (!points.length) {
    return null;
  }
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

function regioned(filter: Filter, items: Drawn[]): Filter {
  const [node] = filter.kind === FilterKind.Svg ? filter.nodes : [];
  const box = frameBox(items);
  if (!node || !box || node.attrs.filterUnits === USER_SPACE) {
    return filter;
  }
  const at = (key: keyof typeof REGION_DEFAULTS, basis: number) => lengthOf(String(node.attrs[key] ?? REGION_DEFAULTS[key]), basis) ?? 0;
  const fraction = (key: keyof typeof REGION_DEFAULTS) => (String(node.attrs[key] ?? REGION_DEFAULTS[key]).endsWith('%') ? at(key, 1) : Number(node.attrs[key]));
  const region = { x: box.x + fraction('x') * box.w, y: box.y + fraction('y') * box.h, width: fraction('width') * box.w, height: fraction('height') * box.h };
  const children = (node.children ?? []).map((c) => (GENERATORS.has(c.tag) ? { ...c, attrs: { ...region, ...c.attrs } } : c));
  return { kind: FilterKind.Svg, nodes: [{ ...node, children }] };
}

const blendEffect: GroupEffect = ({ node, items }) => {
  const mode = node.style['mix-blend-mode'] ?? '';
  if (PLAIN_BLEND.has(mode)) {
    return items;
  }
  return BLENDS.has(mode) && items.length <= 1 ? items.map((d) => ({ ...d, blend: mode as BlendMode })) : DomGap.Blend;
};

const GROUP_EFFECTS: GroupEffect[] = [filterEffect, clipEffect, blendEffect];

function grouped(group: Group): Drawn[] | DomGap {
  let items = group.items;
  for (const effect of GROUP_EFFECTS) {
    const out = effect({ ...group, items });
    if (!Array.isArray(out)) {
      return out;
    }
    items = out;
  }
  return items;
}

const PAINT_GAP: Record<PaintGap, DomGap> = { [PaintGap.Paint]: DomGap.Paint, [PaintGap.Stroke]: DomGap.Stroke };

const PAINTERS: Record<string, Painter> = {
  canvas: layerPainter,
  svg: groupPainter,
  g: groupPainter,
  polygon: shapePainter(pointsOf),
  polyline: shapePainter(pointsOf),
  rect: shapePainter(rectOf),
  circle: shapePainter(circleOf),
  ellipse: shapePainter(ellipseOf),
  path: shapePainter(pathOf),
  text: groupPainter,
  tspan: groupPainter,
  img: mediaPainter,
  video: mediaPainter,
  picture: mediaPainter,
  iframe: mediaPainter,
  object: mediaPainter,
  embed: mediaPainter,
  audio: mediaPainter,
  image: mediaPainter
};

const painterOf = (node: RawNode): Painter => PAINTERS[node.tag] ?? (node.svg ? elementPainter : boxPainter);

const layered = (node: RawNode) => !STATIC.has(node.style.position ?? '') || !isNone(node.style.transform) || opacityOf(node.style) < 1;

function viewportOf(node: RawNode, outer: Size): { viewport: Size; fit: Affine } | null {
  if (node.tag !== 'svg') {
    return { viewport: outer, fit: [1, 0, 0, 1, 0, 0] };
  }
  const size = { w: node.size[0], h: node.size[1] };
  if (!node.attrs.viewBox) {
    return { viewport: size, fit: [1, 0, 0, 1, 0, 0] };
  }
  const box = node.attrs.viewBox.trim().split(/[\s,]+/).map(Number);
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v)) || box[2] <= 0 || box[3] <= 0) {
    return null;
  }
  const [vx, vy, vw, vh] = box;
  const s = Math.min(size.w / vw, size.h / vh);
  return { viewport: { w: vw, h: vh }, fit: [s, 0, 0, s, (size.w - vw * s) / 2 - vx * s, (size.h - vh * s) / 2 - vy * s] };
}

function spills(items: Drawn[], matrix: Affine, size: Size): boolean {
  const local = invert2d(matrix);
  const inside = ([x, y]: [number, number]) => x >= -SPILL_TOLERANCE && y >= -SPILL_TOLERANCE && x <= size.w + SPILL_TOLERANCE && y <= size.h + SPILL_TOLERANCE;
  return items.some((item) => worldPoints(item).some((p) => !inside(apply2d(local, p))));
}

function boxClip(node: RawNode, kids: Drawn[], matrix: Affine): Drawn[] | null {
  const size = { w: node.size[0], h: node.size[1] };
  const shape = boxShapeOf(node.style, size);
  if (!shape || !squared(shape)) {
    return null;
  }
  const mask: MaskLayer = { mode: MaskMode.Intersect, invert: false, level: 1, feather: 0, cover: { kind: CoverKind.Path, contours: [[0, 0, size.w, 0, size.w, size.h, 0, size.h]], matrix } };
  return kids.map((d) => ({ ...d, masks: [...(d.masks ?? []), mask] }));
}

const zOf = (node: RawNode) => (NO_Z.has(node.style['z-index'] ?? '') ? 0 : Number(node.style['z-index']) || 0);

function stacked(kids: RawNode[], ids: number[]): number[] {
  const rank = (node: RawNode) => (!layered(node) ? [0, 0] : zOf(node) < 0 ? [-1, zOf(node)] : [1, zOf(node)]);
  return ids
    .map((id, i) => ({ id, i, r: rank(kids[i]) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.i - b.i)
    .map((k) => k.id);
}

function overlapping(items: Drawn[]): boolean {
  const boxes = items.map((d) => frameBox([d]));
  return boxes.some((a, i) => !a || boxes.some((b, j) => j > i && (!b || (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h))));
}

export function readTree(tree: RawTree, typeset: Typeset = NO_TYPESET): DomRead {
  const { nodes } = tree;
  const children = nodes.map(() => [] as number[]);
  nodes.forEach((n, i) => (n.parent === NO_INDEX ? undefined : children[n.parent].push(i)));
  const gaps = new Map<string, DomGapCount>();
  const gap = (node: RawNode, reason: DomGap) => {
    const element = label(node);
    const key = `${reason}|${element}`;
    const seen = gaps.get(key);
    gaps.set(key, { element, reason, count: (seen?.count ?? 0) + 1 });
  };

  const visit = (i: number, outer: Scope): Drawn[] => {
    const node = nodes[i];
    const refusal = REFUSALS.find(([gap, hit]) => !(gap === DomGap.Order && node.parent === NO_INDEX) && hit(node.style));
    const view = viewportOf(node, outer.viewport);
    if (refusal || !view) {
      gap(node, refusal ? refusal[0] : DomGap.Geometry);
      return [];
    }
    const [x, y] = (node.at ?? [0, 0]).map((v) => (isNone(node.style.transform) ? v : Math.round(v)));
    const matrix = mul2d(mul2d(outer.matrix, [1, 0, 0, 1, x, y]), transformOf(node.style.transform, node.style['transform-origin']) as Affine);
    const visible = !HIDDEN.has(node.style.visibility ?? '');
    const own = visible ? painterOf(node)(node, { ...outer, matrix }) : nothing();
    const text = visible && node.text ? textOf(node, { ...outer, matrix }) : nothing();
    [...own.gaps, ...text.gaps].forEach((reason) => gap(node, reason));
    const order = node.svg ? children[i] : stacked(children[i].map((c) => nodes[c]), children[i]);
    const inner = { ...outer, matrix: mul2d(matrix, view.fit), viewport: view.viewport };
    const kids = order.flatMap((c) => visit(c, inner));
    const size = { w: node.size[0], h: node.size[1] };
    const clipped = CLIPPING.has(node.style.overflow ?? '') && node.at && kids.length && spills(kids, matrix, size) ? boxClip(node, kids, matrix) : kids;
    if (!clipped) {
      gap(node, DomGap.Clip);
      return [];
    }
    const effected = grouped({ node, items: [...own.drawn, ...text.drawn, ...clipped], matrix, viewport: outer.viewport, defs: tree.defs });
    if (!Array.isArray(effected)) {
      gap(node, effected);
      return [];
    }
    const items = effected;
    const opacity = opacityOf(node.style);
    if (opacity < 1 && items.length > 1 && overlapping(items)) {
      return [{ kind: DrawnKind.Group, items, opacity, matrix: [1, 0, 0, 1, 0, 0] }];
    }
    return items.map((d) => ({ ...d, opacity: d.opacity * opacity }));
  };

  const drawn = nodes.length ? visit(0, { matrix: [1, 0, 0, 1, 0, 0], viewport: { w: tree.width, h: tree.height }, typeset, defs: tree.defs }) : [];
  return { drawn, gaps: [...gaps.values()] };
}
