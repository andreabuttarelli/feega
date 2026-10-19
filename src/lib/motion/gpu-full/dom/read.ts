import { apply2d, mul2d, type Affine } from '../../affine';
import { invert2d } from '../../parent';
import { ellipseOutline, flatten, parsePath, rectOutline, type Outline } from '../../shape/geometry';
import { FillRule, MAX_STOPS, PaintKind, type Paint } from '../paint';
import { rgbaOf } from '../rgba';
import { cornerOf, isNone, lengthOf, linearGradient, splitTop, tileOf, transformOf, type Size } from './css';
import { NO_INDEX, type RawNode, type RawTree } from './tree';

export enum DomGap {
  Text = 'text',
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
  Layer = 'layer'
}

export type DrawnPath = { kind: DrawnKind.Path; contours: number[][]; rule: FillRule; paint: Paint; opacity: number; matrix: Affine };
export type DrawnLayer = { kind: DrawnKind.Layer; layer: number; width: number; height: number; opacity: number; matrix: Affine };
export type Drawn = DrawnPath | DrawnLayer;
export type DomGapCount = { element: string; reason: DomGap; count: number };
export type DomRead = { drawn: Drawn[]; gaps: DomGapCount[] };

type Own = { drawn: Drawn[]; gaps: DomGap[] };
type Scope = { matrix: Affine; viewport: Size };
type Style = RawNode['style'];
type BoxShape = { round: true; radii: number[] } | { round: false; ellipse: true };
type Painter = (node: RawNode, scope: Scope) => Own;

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
  [DomGap.Filter, (s) => !isNone(s.filter) || !isNone(s['backdrop-filter'])],
  [DomGap.Blend, (s) => !PLAIN_BLEND.has(s['mix-blend-mode'] ?? '')],
  [DomGap.Mask, (s) => !isNone(s['clip-path']) || !isNone(s['mask-image'])],
  [DomGap.Order, (s) => !NO_Z.has(s['z-index'] ?? '')],
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

const boxPainter: Painter = (node, scope) => {
  const size = { w: node.size[0], h: node.size[1] };
  const shape = boxShapeOf(node.style, size);
  if (!shape) {
    return nothing(DomGap.Radius);
  }
  const background = backgroundOf(node.style, size, shape, scope.matrix);
  const border = borderOf(node.style, size, shape, scope.matrix);
  const shadow = isNone(node.style['box-shadow']) ? [] : [DomGap.Shadow];
  return { drawn: [...background.drawn, ...border.drawn], gaps: [...background.gaps, ...border.gaps, ...shadow] };
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
    const stroke = !isNone(node.style.stroke) && px(node.style['stroke-width']) > 0 ? [DomGap.Stroke] : [];
    if (!outline) {
      return nothing(DomGap.Geometry, ...stroke);
    }
    const color = rgbaOf(node.style.fill ?? '');
    if (isNone(node.style.fill) || color?.[3] === 0) {
      return nothing(...stroke);
    }
    if (!color) {
      return nothing(DomGap.Paint, ...stroke);
    }
    const rule = node.style['fill-rule'] === FillRule.EvenOdd ? FillRule.EvenOdd : FillRule.NonZero;
    const fillOpacity = node.style['fill-opacity'] ? Number(node.style['fill-opacity']) : 1;
    return { drawn: [path(flat(outline), solid(color), scope.matrix, rule, fillOpacity)], gaps: stroke };
  };

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
  return items.some((item) => {
    const toLocal = mul2d(local, item.matrix);
    const points: [number, number][] =
      item.kind === DrawnKind.Layer
        ? [[0, 0], [item.width, 0], [item.width, item.height], [0, item.height]]
        : item.contours.flatMap((c) => Array.from({ length: c.length / 2 }, (_, i): [number, number] => [c[2 * i], c[2 * i + 1]]));
    return points.some((p) => !inside(apply2d(toLocal, p)));
  });
}

export function readTree(tree: RawTree): DomRead {
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
    const refusal = REFUSALS.find(([, hit]) => hit(node.style));
    const view = viewportOf(node, outer.viewport);
    if (refusal || !view) {
      gap(node, refusal ? refusal[0] : DomGap.Geometry);
      return [];
    }
    const [x, y] = node.at ?? [0, 0];
    const matrix = mul2d(mul2d(outer.matrix, [1, 0, 0, 1, x, y]), transformOf(node.style.transform, node.style['transform-origin']) as Affine);
    const visible = !HIDDEN.has(node.style.visibility ?? '');
    const own = visible ? painterOf(node)(node, { matrix, viewport: outer.viewport }) : nothing();
    own.gaps.forEach((reason) => gap(node, reason));
    if (visible && node.text) {
      gap(node, DomGap.Text);
    }
    const order = node.svg ? children[i] : [...children[i].filter((c) => !layered(nodes[c])), ...children[i].filter((c) => layered(nodes[c]))];
    const inner = { matrix: mul2d(matrix, view.fit), viewport: view.viewport };
    const kids = order.flatMap((c) => visit(c, inner));
    const size = { w: node.size[0], h: node.size[1] };
    if (CLIPPING.has(node.style.overflow ?? '') && node.at && kids.length && spills(kids, matrix, size)) {
      gap(node, DomGap.Clip);
      return [];
    }
    const items = [...own.drawn, ...kids];
    const opacity = opacityOf(node.style);
    if (opacity < 1 && items.length > 1) {
      gap(node, DomGap.Opacity);
      return [];
    }
    return items.map((d) => ({ ...d, opacity: d.opacity * opacity }));
  };

  const drawn = nodes.length ? visit(0, { matrix: [1, 0, 0, 1, 0, 0], viewport: { w: tree.width, h: tree.height } }) : [];
  return { drawn, gaps: [...gaps.values()] };
}
